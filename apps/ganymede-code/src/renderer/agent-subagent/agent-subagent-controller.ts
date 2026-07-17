export type AgentSubagentPhase =
  | 'queued'
  | 'running'
  | 'suspended'
  | 'completed'
  | 'failed';

export interface AgentSubagentView {
  readonly parentToolCallId: string;
  readonly subagentId: string;
  readonly name: string;
  readonly description: string;
  readonly phase: AgentSubagentPhase;
  readonly latestActivity: string;
  readonly currentTool?: string;
  readonly toolCount: number;
  readonly completedText?: string;
  readonly failureText?: string;
}

const MAX_ACTIVITY_CHARS = 2_000;

function phaseFromLifecycle(lifecycle: string): AgentSubagentPhase {
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
 * Tracks foreground single-Agent tool subagents for inline progress UI.
 * Background agents are ignored (Agents panel via listBackgroundTasks).
 */
export class AgentSubagentController {
  private readonly byParent = new Map<string, AgentSubagentView>();
  private readonly bySubagentId = new Map<string, string>();

  reset(): void {
    this.byParent.clear();
    this.bySubagentId.clear();
  }

  getState(): ReadonlyMap<string, AgentSubagentView> {
    return new Map(this.byParent);
  }

  get(parentToolCallId: string): AgentSubagentView | undefined {
    return this.byParent.get(parentToolCallId);
  }

  ensureParent(parentToolCallId: string): void {
    if (parentToolCallId.length === 0 || this.byParent.has(parentToolCallId)) return;
    // Placeholder until subagent.spawned arrives — optional, spawn creates the real entry.
  }

  onSpawned(input: {
    readonly parentToolCallId: string;
    readonly subagentId: string;
    readonly name: string;
    readonly description?: string;
  }): boolean {
    if (input.parentToolCallId.length === 0 || input.subagentId.length === 0) return false;
    const view: AgentSubagentView = {
      parentToolCallId: input.parentToolCallId,
      subagentId: input.subagentId,
      name: input.name || 'agent',
      description: input.description ?? '',
      phase: 'queued',
      latestActivity: '',
      toolCount: 0,
    };
    this.byParent.set(input.parentToolCallId, view);
    this.bySubagentId.set(input.subagentId, input.parentToolCallId);
    return true;
  }

  onLifecycle(input: {
    readonly subagentId: string;
    readonly lifecycle: string;
    readonly resultSummary?: string;
    readonly error?: string;
    readonly reason?: string;
  }): boolean {
    const parentId = this.bySubagentId.get(input.subagentId);
    if (parentId === undefined) return false;
    const previous = this.byParent.get(parentId);
    if (previous === undefined) return false;
    const phase = phaseFromLifecycle(input.lifecycle);
    this.byParent.set(parentId, {
      ...previous,
      phase,
      completedText:
        input.lifecycle === 'completed'
          ? (input.resultSummary ?? previous.completedText)
          : previous.completedText,
      failureText:
        input.lifecycle === 'failed'
          ? (input.error ?? previous.failureText)
          : previous.failureText,
      latestActivity:
        input.lifecycle === 'suspended' && input.reason !== undefined && input.reason.length > 0
          ? input.reason
          : previous.latestActivity,
    });
    return true;
  }

  appendActivity(subagentId: string, text: string): boolean {
    if (text.length === 0) return false;
    const parentId = this.bySubagentId.get(subagentId);
    if (parentId === undefined) return false;
    const previous = this.byParent.get(parentId);
    if (previous === undefined) return false;
    this.byParent.set(parentId, {
      ...previous,
      phase: previous.phase === 'queued' ? 'running' : previous.phase,
      latestActivity: `${previous.latestActivity}${text}`.slice(-MAX_ACTIVITY_CHARS),
    });
    return true;
  }

  recordToolCall(input: {
    readonly subagentId: string;
    readonly toolName?: string;
  }): boolean {
    const parentId = this.bySubagentId.get(input.subagentId);
    if (parentId === undefined) return false;
    const previous = this.byParent.get(parentId);
    if (previous === undefined) return false;
    const toolName = input.toolName ?? 'Tool';
    this.byParent.set(parentId, {
      ...previous,
      phase: previous.phase === 'queued' ? 'running' : previous.phase,
      currentTool: toolName,
      toolCount: previous.toolCount + 1,
      latestActivity: `Using ${toolName}`,
    });
    return true;
  }

  finishToolCall(subagentId: string): boolean {
    const parentId = this.bySubagentId.get(subagentId);
    if (parentId === undefined) return false;
    const previous = this.byParent.get(parentId);
    if (previous === undefined) return false;
    this.byParent.set(parentId, {
      ...previous,
      currentTool: undefined,
    });
    return true;
  }
}
