export type InteractionMode = 'agent' | 'plan' | 'debug' | 'multitask' | 'ask' | 'engineering';

export const INTERACTION_MODES = [
  'agent',
  'plan',
  'debug',
  'multitask',
  'ask',
  'engineering',
] as const satisfies readonly InteractionMode[];

export function isInteractionMode(value: unknown): value is InteractionMode {
  return (
    value === 'agent' ||
    value === 'plan' ||
    value === 'debug' ||
    value === 'multitask' ||
    value === 'ask' ||
    value === 'engineering'
  );
}
