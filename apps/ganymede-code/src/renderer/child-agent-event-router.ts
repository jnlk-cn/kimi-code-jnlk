import { AgentSubagentController } from './agent-subagent';
import { SwarmEventController, type SubagentInfo } from './agent-swarm';

export const MAIN_AGENT_ID = 'main';

const CHILD_STREAM_TYPES = new Set([
  'assistant.delta',
  'thinking.delta',
  'tool.call.started',
  'tool.call.delta',
  'tool.progress',
  'tool.result',
  'hook.result',
  'agent.status.updated',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Routes foreground child-agent events into AgentSwarm / Agent progress UIs,
 * matching Kimi Code TUI SubAgentEventHandler.routeChildAgentEvent semantics.
 *
 * Returns true when the event was consumed for child-agent UI (bump revision).
 * Callers should still run reduceLiveEvent; the timeline guard drops child streams.
 */
export class ChildAgentEventRouter {
  private readonly swarm: SwarmEventController;
  private readonly agents: AgentSubagentController;
  private readonly agentParents = new Set<string>();
  private readonly subagentInfo = new Map<string, SubagentInfo>();

  constructor(
    swarm: SwarmEventController = new SwarmEventController(),
    agents: AgentSubagentController = new AgentSubagentController(),
  ) {
    this.swarm = swarm;
    this.agents = agents;
  }

  getSwarmController(): SwarmEventController {
    return this.swarm;
  }

  getAgentController(): AgentSubagentController {
    return this.agents;
  }

  reset(): void {
    this.swarm.reset();
    this.agents.reset();
    this.agentParents.clear();
    this.subagentInfo.clear();
  }

  markActiveCancelled(): void {
    this.swarm.markActiveCancelled();
  }

  hasActiveSwarm(): boolean {
    return this.swarm.hasActiveSwarm();
  }

  /** Returns true when child-agent / swarm UI state changed. */
  routeEvent(event: Readonly<Record<string, unknown>>): boolean {
    const type = String(event['type'] ?? '');

    // Child-agent streaming / nested tool events — divert before parent tool handling.
    if (CHILD_STREAM_TYPES.has(type) && !type.startsWith('subagent.')) {
      const agentId = event['agentId'];
      if (typeof agentId === 'string' && agentId !== MAIN_AGENT_ID) {
        return this.routeChildStream(event, type, agentId);
      }
    }

    if (type === 'tool.call.started') {
      const name = String(event['name'] ?? '');
      const toolCallId = String(event['toolCallId'] ?? '');
      if (name === 'Agent' && toolCallId.length > 0) {
        this.agentParents.add(toolCallId);
        this.agents.ensureParent(toolCallId);
      }
      if (name === 'AgentSwarm') {
        return this.swarm.handleEvent(event);
      }
      return false;
    }

    if (type === 'tool.call.delta' || type === 'tool.result') {
      return this.swarm.handleEvent(event);
    }

    if (type.startsWith('subagent.')) {
      return this.handleLifecycle(event, type);
    }

    if (type === 'turn.started' || type === 'turn.ended') {
      this.swarm.handleEvent(event);
      return false;
    }

    return false;
  }

  private handleLifecycle(
    event: Readonly<Record<string, unknown>>,
    type: string,
  ): boolean {
    const lifecycle = type.slice('subagent.'.length);
    const subagentId = String(event['subagentId'] ?? '');
    if (subagentId.length === 0) return false;

    if (lifecycle === 'spawned') {
      const parentToolCallId = String(event['parentToolCallId'] ?? '');
      const runInBackground = event['runInBackground'] === true;
      const swarmIndex =
        typeof event['swarmIndex'] === 'number' ? event['swarmIndex'] : undefined;
      const info: SubagentInfo = {
        parentToolCallId,
        name: String(event['subagentName'] ?? 'agent'),
        runInBackground,
        swarmIndex,
      };
      this.subagentInfo.set(subagentId, info);

      if (runInBackground || parentToolCallId.length === 0) {
        // Still let SwarmEventController record for consistency; it ignores background.
        this.swarm.handleEvent(event);
        return false;
      }

      if (this.swarm.hasSwarm(parentToolCallId) || swarmIndex !== undefined) {
        return this.swarm.handleEvent(event);
      }

      if (this.agentParents.has(parentToolCallId) || parentToolCallId.length > 0) {
        this.agentParents.add(parentToolCallId);
        return this.agents.onSpawned({
          parentToolCallId,
          subagentId,
          name: info.name,
          description: String(event['description'] ?? ''),
        });
      }
      return false;
    }

    const info = this.subagentInfo.get(subagentId) ?? this.swarm.getSubagentInfo(subagentId);
    if (info === undefined || info.runInBackground) {
      this.swarm.handleEvent(event);
      return false;
    }

    if (this.swarm.hasSwarm(info.parentToolCallId)) {
      return this.swarm.handleEvent(event);
    }

    return this.agents.onLifecycle({
      subagentId,
      lifecycle,
      resultSummary: typeof event['resultSummary'] === 'string' ? event['resultSummary'] : undefined,
      error: typeof event['error'] === 'string' ? event['error'] : undefined,
      reason: typeof event['reason'] === 'string' ? event['reason'] : undefined,
    });
  }

  private routeChildStream(
    event: Readonly<Record<string, unknown>>,
    type: string,
    agentId: string,
  ): boolean {
    const info = this.subagentInfo.get(agentId) ?? this.swarm.getSubagentInfo(agentId);
    // Unknown child agent — swallow so the main timeline is not polluted.
    if (info === undefined || info.parentToolCallId.length === 0) return true;
    if (info.runInBackground) return true;

    if (this.swarm.hasSwarm(info.parentToolCallId)) {
      return this.applyToSwarm(event, type, agentId);
    }

    return this.applyToAgent(event, type, agentId);
  }

  private applyToSwarm(
    event: Readonly<Record<string, unknown>>,
    type: string,
    agentId: string,
  ): boolean {
    if (type === 'assistant.delta' || type === 'thinking.delta') {
      return this.swarm.appendModelDelta({
        agentId,
        delta: String(event['delta'] ?? ''),
      });
    }
    if (type === 'tool.call.started') {
      return this.swarm.recordToolCall({
        agentId,
        toolCallId: String(event['toolCallId'] ?? ''),
        toolName: String(event['name'] ?? ''),
      });
    }
    if (type === 'hook.result') {
      const content = String(event['content'] ?? event['message'] ?? '');
      return this.swarm.appendModelDelta({ agentId, delta: content });
    }
    // Other child tool events: consume without further UI noise.
    return true;
  }

  private applyToAgent(
    event: Readonly<Record<string, unknown>>,
    type: string,
    agentId: string,
  ): boolean {
    if (type === 'assistant.delta' || type === 'thinking.delta') {
      return this.agents.appendActivity(agentId, String(event['delta'] ?? ''));
    }
    if (type === 'tool.call.started') {
      return this.agents.recordToolCall({
        subagentId: agentId,
        toolName: String(event['name'] ?? ''),
      });
    }
    if (type === 'tool.result') {
      return this.agents.finishToolCall(agentId);
    }
    if (type === 'hook.result') {
      return this.agents.appendActivity(
        agentId,
        String(event['content'] ?? event['message'] ?? ''),
      );
    }
    if (type === 'tool.progress') {
      const update = asRecord(event['update']);
      const text = String(update['text'] ?? '');
      if (text.length > 0) return this.agents.appendActivity(agentId, text);
      return true;
    }
    return true;
  }
}
