import type { AgentSwarmMemberPhase, AgentSwarmResultSummary } from './parse';
import {
  agentSwarmDescriptionFromArgs,
  agentSwarmItemsFromArgs,
  agentSwarmPartialDescriptionFromArguments,
  agentSwarmPartialItemsFromArguments,
  agentSwarmPartialResumeItemsFromArguments,
  agentSwarmResumeItemsFromArgs,
  agentSwarmResultSummaryFromOutput,
  agentSwarmWorkItemsStartedFromArguments,
  formatAgentSwarmError,
  formatAgentSwarmSummaryLabel,
} from './parse';
import { calculateAgentSwarmGridLayout } from './types';

export type { AgentSwarmMemberPhase, AgentSwarmResultSummary };
export type SwarmModeMarkerState = 'active' | 'inactive' | 'ended';
export type SwarmModeEntry = 'manual' | 'task';

export interface SwarmMemberView {
  readonly id: string;
  readonly agentId?: string;
  readonly index: number;
  readonly phase: AgentSwarmMemberPhase;
  readonly itemText: string;
  readonly latestModelText: string;
  readonly completedText?: string;
  readonly failureText?: string;
  readonly suspendedReason?: string;
}

export interface SwarmProgressView {
  readonly toolCallId: string;
  readonly description: string;
  readonly items: readonly string[];
  readonly members: readonly SwarmMemberView[];
  readonly streaming: boolean;
  readonly ended: boolean;
  readonly failed: boolean;
  readonly aborted: boolean;
  readonly errorMessage?: string;
  readonly summaryLabel?: string;
  readonly summary?: AgentSwarmResultSummary;
  readonly columns: number;
}

export interface SwarmControllerState {
  readonly swarms: ReadonlyMap<string, SwarmProgressView>;
  readonly activeToolCallId?: string;
}

export interface SubagentInfo {
  readonly parentToolCallId: string;
  readonly name: string;
  readonly runInBackground: boolean;
  readonly swarmIndex?: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseToolArgs(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || value.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return asRecord(parsed);
  } catch {
    return {};
  }
}

function emptySwarm(toolCallId: string, description: string, items: readonly string[]): SwarmProgressView {
  const members = items.map((itemText, index) => ({
    id: `${toolCallId}:${String(index + 1)}`,
    index: index + 1,
    phase: 'pending' as const,
    itemText,
    latestModelText: '',
  }));
  return {
    toolCallId,
    description,
    items,
    members,
    streaming: true,
    ended: false,
    failed: false,
    aborted: false,
    columns: calculateAgentSwarmGridLayout({ count: members.length }).columns,
  };
}

function upsertMember(
  members: readonly SwarmMemberView[],
  next: SwarmMemberView,
): readonly SwarmMemberView[] {
  const index = members.findIndex(
    (member) =>
      (next.agentId !== undefined && member.agentId === next.agentId) ||
      member.id === next.id ||
      member.index === next.index,
  );
  if (index < 0) return [...members, next];
  const copy = [...members];
  copy[index] = { ...members[index]!, ...next, id: members[index]!.id };
  return copy;
}

function memberPhaseFromLifecycle(lifecycle: string): AgentSwarmMemberPhase {
  switch (lifecycle) {
    case 'spawned':
      return 'queued';
    case 'started':
      return 'running';
    case 'suspended':
      return 'suspended';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'queued';
  }
}

/**
 * Stateful reducer for AgentSwarm tool + subagent lifecycle events.
 * Foreground swarm members feed progress views; background agents are ignored here
 * (they continue to surface via listBackgroundTasks / AgentsPanel).
 */
export class SwarmEventController {
  private swarms = new Map<string, SwarmProgressView>();
  private subagentInfo = new Map<string, SubagentInfo>();
  private activeToolCallId: string | undefined;

  reset(): void {
    this.swarms.clear();
    this.subagentInfo.clear();
    this.activeToolCallId = undefined;
  }

  getState(): SwarmControllerState {
    return {
      swarms: new Map(this.swarms),
      activeToolCallId: this.activeToolCallId,
    };
  }

  hasActiveSwarm(): boolean {
    if (this.activeToolCallId === undefined) return false;
    const swarm = this.swarms.get(this.activeToolCallId);
    return swarm !== undefined && !swarm.ended;
  }

  getSwarm(toolCallId: string): SwarmProgressView | undefined {
    return this.swarms.get(toolCallId);
  }

  hasSwarm(toolCallId: string): boolean {
    return this.swarms.has(toolCallId);
  }

  getSubagentInfo(subagentId: string): SubagentInfo | undefined {
    return this.subagentInfo.get(subagentId);
  }

  /** Append streaming model text for a foreground swarm member. */
  appendModelDelta(input: { readonly agentId: string; readonly delta: string }): boolean {
    if (input.delta.length === 0) return false;
    for (const [toolCallId, swarm] of this.swarms) {
      const index = swarm.members.findIndex((member) => member.agentId === input.agentId);
      if (index < 0) continue;
      const member = swarm.members[index]!;
      const latestModelText = `${member.latestModelText}${input.delta}`.slice(-2_000);
      const members = [...swarm.members];
      members[index] = {
        ...member,
        latestModelText,
        phase: member.phase === 'pending' || member.phase === 'queued' ? 'running' : member.phase,
      };
      this.swarms.set(toolCallId, { ...swarm, members });
      return true;
    }
    return false;
  }

  /** Record a tool call started by a foreground swarm member. */
  recordToolCall(input: {
    readonly agentId: string;
    readonly toolCallId: string;
    readonly toolName?: string;
  }): boolean {
    for (const [parentId, swarm] of this.swarms) {
      const index = swarm.members.findIndex((member) => member.agentId === input.agentId);
      if (index < 0) continue;
      const member = swarm.members[index]!;
      const label =
        input.toolName !== undefined && input.toolName.length > 0
          ? `Using ${input.toolName}`
          : member.latestModelText;
      const members = [...swarm.members];
      members[index] = {
        ...member,
        latestModelText: label,
        phase: member.phase === 'pending' || member.phase === 'queued' ? 'running' : member.phase,
      };
      this.swarms.set(parentId, { ...swarm, members });
      return true;
    }
    return false;
  }

  /** Returns true when the event was consumed as a foreground swarm update. */
  handleEvent(event: Readonly<Record<string, unknown>>): boolean {
    const type = String(event['type'] ?? '');

    if (type === 'turn.started') {
      // Keep completed swarms for transcript; only clear the active pointer if needed.
      return false;
    }

    if (type === 'tool.call.started' && String(event['name'] ?? '') === 'AgentSwarm') {
      const toolCallId = String(event['toolCallId'] ?? '');
      if (toolCallId.length === 0) return true;
      const args = parseToolArgs(event['args']);
      const description = agentSwarmDescriptionFromArgs(args);
      const items = [
        ...agentSwarmResumeItemsFromArgs(args),
        ...agentSwarmItemsFromArgs(args),
      ];
      this.swarms.set(toolCallId, emptySwarm(toolCallId, description, items));
      this.activeToolCallId = toolCallId;
      return true;
    }

    if (type === 'tool.call.delta') {
      const toolCallId = String(event['toolCallId'] ?? '');
      const swarm = this.swarms.get(toolCallId);
      if (swarm === undefined) return false;
      const argumentsPart = String(event['argumentsPart'] ?? '');
      if (argumentsPart.length === 0) return true;
      const argsText = String(event['arguments'] ?? event['args'] ?? '');
      const streamText =
        argsText.length > 0 ? argsText : this.appendArgsDelta(toolCallId, argumentsPart);
      const description =
        agentSwarmPartialDescriptionFromArguments(streamText) || swarm.description;
      const items = agentSwarmWorkItemsStartedFromArguments(streamText)
        ? [
            ...agentSwarmPartialResumeItemsFromArguments(streamText),
            ...agentSwarmPartialItemsFromArguments(streamText),
          ]
        : [...swarm.items];
      const members =
        items.length === 0
          ? swarm.members
          : items.map((itemText, index) => {
              const previous = swarm.members[index];
              return {
                id: previous?.id ?? `${toolCallId}:${String(index + 1)}`,
                agentId: previous?.agentId,
                index: index + 1,
                phase: previous?.phase ?? ('pending' as const),
                itemText,
                latestModelText: previous?.latestModelText ?? '',
                completedText: previous?.completedText,
                failureText: previous?.failureText,
                suspendedReason: previous?.suspendedReason,
              };
            });
      this.swarms.set(toolCallId, {
        ...swarm,
        description,
        items,
        members,
        columns: calculateAgentSwarmGridLayout({ count: members.length }).columns,
      });
      return true;
    }

    if (type === 'tool.result') {
      const toolCallId = String(event['toolCallId'] ?? '');
      const swarm = this.swarms.get(toolCallId);
      if (swarm === undefined) return false;
      const output = typeof event['output'] === 'string'
        ? event['output']
        : JSON.stringify(event['output'] ?? '');
      const isError = event['isError'] === true;
      const summary = agentSwarmResultSummaryFromOutput(output);
      const members = this.applyResultToMembers(swarm, summary, output, isError);
      const aborted =
        isError && /\b(?:aborted|cancelled)\b/i.test(output) && !summary.parsed;
      const failed = isError && !summary.parsed && !aborted;
      this.swarms.set(toolCallId, {
        ...swarm,
        members,
        streaming: false,
        ended: true,
        failed,
        aborted,
        errorMessage: failed || aborted ? formatAgentSwarmError(output) : undefined,
        summary,
        summaryLabel: formatAgentSwarmSummaryLabel(summary),
        columns: calculateAgentSwarmGridLayout({ count: members.length }).columns,
      });
      if (this.activeToolCallId === toolCallId) this.activeToolCallId = undefined;
      this.argsBuffers.delete(toolCallId);
      return true;
    }

    if (type.startsWith('subagent.')) {
      return this.handleSubagentEvent(event, type);
    }

    if (type === 'turn.ended') {
      for (const [id, swarm] of this.swarms) {
        if (!swarm.ended && swarm.streaming) {
          this.swarms.set(id, { ...swarm, streaming: false });
        }
      }
      return false;
    }

    return false;
  }

  markActiveCancelled(): void {
    for (const [id, swarm] of this.swarms) {
      if (swarm.ended) continue;
      const members = swarm.members.map((member) =>
        member.phase === 'completed' || member.phase === 'failed' || member.phase === 'cancelled'
          ? member
          : { ...member, phase: 'cancelled' as const },
      );
      this.swarms.set(id, {
        ...swarm,
        members,
        streaming: false,
        ended: true,
        aborted: true,
        summaryLabel: '已取消',
      });
    }
    this.activeToolCallId = undefined;
  }

  private readonly argsBuffers = new Map<string, string>();

  private appendArgsDelta(toolCallId: string, part: string): string {
    const next = `${this.argsBuffers.get(toolCallId) ?? ''}${part}`;
    this.argsBuffers.set(toolCallId, next);
    return next;
  }

  private handleSubagentEvent(
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
      this.subagentInfo.set(subagentId, {
        parentToolCallId,
        name: String(event['subagentName'] ?? 'agent'),
        runInBackground,
        swarmIndex,
      });
      if (runInBackground || parentToolCallId.length === 0) return false;
      const swarm = this.swarms.get(parentToolCallId);
      if (swarm === undefined) return false;
      const index = swarmIndex ?? swarm.members.length + 1;
      const itemText =
        swarm.members.find((member) => member.index === index)?.itemText ??
        String(event['description'] ?? '');
      const members = upsertMember(swarm.members, {
        id: `${parentToolCallId}:${String(index)}`,
        agentId: subagentId,
        index,
        phase: 'queued',
        itemText,
        latestModelText: '',
      });
      this.swarms.set(parentToolCallId, {
        ...swarm,
        members,
        columns: calculateAgentSwarmGridLayout({ count: members.length }).columns,
      });
      return true;
    }

    const info = this.subagentInfo.get(subagentId);
    if (info === undefined || info.runInBackground || info.parentToolCallId.length === 0) {
      return false;
    }
    const swarm = this.swarms.get(info.parentToolCallId);
    if (swarm === undefined) return false;

    const phase = memberPhaseFromLifecycle(lifecycle);
    const existing =
      swarm.members.find((member) => member.agentId === subagentId) ??
      swarm.members.find((member) => member.index === info.swarmIndex);
    const index = existing?.index ?? info.swarmIndex ?? swarm.members.length + 1;
    const members = upsertMember(swarm.members, {
      id: existing?.id ?? `${info.parentToolCallId}:${String(index)}`,
      agentId: subagentId,
      index,
      phase,
      itemText: existing?.itemText ?? String(event['description'] ?? info.name),
      latestModelText: existing?.latestModelText ?? '',
      completedText:
        lifecycle === 'completed'
          ? String(event['resultSummary'] ?? existing?.completedText ?? '')
          : existing?.completedText,
      failureText:
        lifecycle === 'failed'
          ? String(event['error'] ?? existing?.failureText ?? '')
          : existing?.failureText,
      suspendedReason:
        lifecycle === 'suspended'
          ? String(event['reason'] ?? existing?.suspendedReason ?? '')
          : existing?.suspendedReason,
    });
    this.swarms.set(info.parentToolCallId, {
      ...swarm,
      members,
      columns: calculateAgentSwarmGridLayout({ count: members.length }).columns,
    });
    return true;
  }

  private applyResultToMembers(
    swarm: SwarmProgressView,
    summary: AgentSwarmResultSummary,
    output: string,
    isError: boolean,
  ): readonly SwarmMemberView[] {
    if (summary.parsed) {
      const byIndex = new Map(summary.statuses.map((status) => [status.index, status]));
      return swarm.members.map((member) => {
        const status = byIndex.get(member.index);
        if (status === undefined) return member;
        return {
          ...member,
          agentId: status.agentId ?? member.agentId,
          phase: status.status,
          completedText: status.completedText ?? member.completedText,
          failureText: status.failureText ?? member.failureText,
        };
      });
    }
    if (isError) {
      return swarm.members.map((member) =>
        member.phase === 'completed'
          ? member
          : {
              ...member,
              phase: /\b(?:aborted|cancelled)\b/i.test(output)
                ? ('cancelled' as const)
                : ('failed' as const),
              failureText: member.failureText ?? formatAgentSwarmError(output),
            },
      );
    }
    return swarm.members.map((member) =>
      member.phase === 'failed' || member.phase === 'cancelled'
        ? member
        : { ...member, phase: 'completed' as const },
    );
  }
}

export function swarmMarkerLabel(state: SwarmModeMarkerState): string {
  switch (state) {
    case 'active':
      return '集群模式已开启';
    case 'inactive':
      return '集群模式已关闭';
    case 'ended':
      return '集群任务已结束';
  }
}
