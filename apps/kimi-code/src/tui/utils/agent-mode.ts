import type { Session } from '@moonshot-ai/kimi-code-sdk';

import type { AgentMode, AppState } from '#/tui/types';

export type { AgentMode } from '#/tui/types';

export const AGENT_MODE_CYCLE: readonly AgentMode[] = ['agent', 'plan', 'ask', 'debug'];

export function currentAgentMode(
  state: Pick<AppState, 'planMode' | 'askMode' | 'debugMode'>,
): AgentMode {
  if (state.planMode) return 'plan';
  if (state.askMode) return 'ask';
  if (state.debugMode) return 'debug';
  return 'agent';
}

export function nextAgentMode(mode: AgentMode): AgentMode {
  const index = AGENT_MODE_CYCLE.indexOf(mode);
  return AGENT_MODE_CYCLE[(index + 1) % AGENT_MODE_CYCLE.length] ?? 'agent';
}

export function agentModeAppStatePatch(mode: AgentMode): Partial<AppState> {
  return {
    planMode: mode === 'plan',
    askMode: mode === 'ask',
    debugMode: mode === 'debug',
  };
}

export async function exitAgentMode(session: Session, mode: AgentMode): Promise<void> {
  if (mode === 'plan') await session.setPlanMode(false);
  else if (mode === 'ask') await session.setAskMode(false);
  else if (mode === 'debug') await session.setDebugMode(false);
}
