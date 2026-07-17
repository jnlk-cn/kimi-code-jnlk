/** CSS-friendly grid layout for AgentSwarm member cells (web adaptation of kimi-code layout). */

export interface AgentSwarmGridLayoutInput {
  readonly count: number;
  readonly preferredColumns?: number;
}

export interface AgentSwarmGridLayout {
  readonly columns: number;
  readonly rows: number;
}

export function calculateAgentSwarmGridLayout(
  input: AgentSwarmGridLayoutInput,
): AgentSwarmGridLayout {
  const count = Math.max(0, Math.floor(input.count));
  if (count === 0) return { columns: 0, rows: 0 };
  const preferred = input.preferredColumns ?? 3;
  const columns = Math.max(1, Math.min(count, preferred));
  return {
    columns,
    rows: Math.ceil(count / columns),
  };
}
