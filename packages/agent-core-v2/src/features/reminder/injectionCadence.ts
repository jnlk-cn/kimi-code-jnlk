import type { ContextMessage } from '#/agent/contextMemory/types';

export type InjectionCadence = 'full' | 'sparse' | null;

export interface InjectionCadenceOptions {
  readonly dedupMinTurns: number;
  readonly fullRefreshTurns: number;
}

export function injectionCadence(
  injectedAt: number | null,
  history: readonly ContextMessage[],
  options: InjectionCadenceOptions,
): InjectionCadence {
  if (injectedAt === null) return 'full';
  let assistantTurnsSince = 0;
  for (let i = injectedAt + 1; i < history.length; i++) {
    const message = history[i];
    if (message === undefined) continue;
    if (message.role === 'assistant') {
      assistantTurnsSince += 1;
      continue;
    }
    if (message.role === 'user' && message.origin?.kind !== 'injection') {
      return 'full';
    }
  }
  if (assistantTurnsSince >= options.fullRefreshTurns) return 'full';
  if (assistantTurnsSince >= options.dedupMinTurns) return 'sparse';
  return null;
}
