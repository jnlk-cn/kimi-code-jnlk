import {
  INTERACTION_MODES,
  type InteractionMode,
  isInteractionMode,
} from '@moonshot-ai/kimi-code-sdk';

const LABELS_ZH: Record<InteractionMode, string> = {
  agent: '助理',
  plan: '计划',
  debug: '排障',
  multitask: '集群',
  ask: '问答',
  engineering: '工程',
};

const LABELS_EN: Record<InteractionMode, string> = {
  agent: 'Agent',
  plan: 'Plan',
  debug: 'Debug',
  multitask: 'Multitask',
  ask: 'Ask',
  engineering: 'Engineering',
}

/** Prefer Chinese badge/selector copy when the process locale is Chinese. */
export function preferChineseUi(): boolean {
  const lang = process.env['LANG'] ?? process.env['LC_ALL'] ?? process.env['LC_MESSAGES'] ?? '';
  return /^zh\b/i.test(lang);
}

export function interactionModeLabel(mode: InteractionMode): string {
  return preferChineseUi() ? LABELS_ZH[mode] : LABELS_EN[mode];
}

export function nextInteractionMode(current: InteractionMode): InteractionMode {
  const index = INTERACTION_MODES.indexOf(current);
  const safeIndex = index < 0 ? 0 : index;
  return INTERACTION_MODES[(safeIndex + 1) % INTERACTION_MODES.length]!;
}

export { INTERACTION_MODES, isInteractionMode };
export type { InteractionMode };
