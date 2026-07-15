import type { InteractionMode } from './types';

export type { InteractionMode } from './types';

export const INTERACTION_MODES = [
  'agent',
  'plan',
  'debug',
  'multitask',
  'ask',
] as const satisfies readonly InteractionMode[];

export function isInteractionMode(value: unknown): value is InteractionMode {
  return (
    value === 'agent' ||
    value === 'plan' ||
    value === 'debug' ||
    value === 'multitask' ||
    value === 'ask'
  );
}

export interface InteractionModeToggles {
  readonly plan: boolean;
  readonly swarm: boolean;
  readonly ask: boolean;
  readonly debug: boolean;
}

export function interactionModeToToggles(mode: InteractionMode): InteractionModeToggles {
  switch (mode) {
    case 'agent':
      return { plan: false, swarm: false, ask: false, debug: false };
    case 'plan':
      return { plan: true, swarm: false, ask: false, debug: false };
    case 'ask':
      return { plan: false, swarm: false, ask: true, debug: false };
    case 'debug':
      return { plan: false, swarm: false, ask: false, debug: true };
    case 'multitask':
      return { plan: false, swarm: true, ask: false, debug: false };
    default: {
      const _exhaustive: never = mode;
      throw new Error(`Unhandled InteractionMode: ${String(_exhaustive)}`);
    }
  }
}

export function deriveInteractionMode(input: {
  readonly planMode?: boolean;
  readonly swarmMode?: boolean;
  readonly askMode?: boolean;
  readonly debugMode?: boolean;
  readonly interactionMode?: InteractionMode;
}): InteractionMode {
  if (input.interactionMode !== undefined) return input.interactionMode;
  if (input.askMode === true) return 'ask';
  if (input.debugMode === true) return 'debug';
  if (input.planMode === true) return 'plan';
  if (input.swarmMode === true) return 'multitask';
  return 'agent';
}
