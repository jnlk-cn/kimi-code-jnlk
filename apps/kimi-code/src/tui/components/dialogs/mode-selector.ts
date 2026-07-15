import type { InteractionMode } from '@moonshot-ai/kimi-code-sdk';

import {
  INTERACTION_MODES,
  interactionModeLabel,
  isInteractionMode,
  preferChineseUi,
} from '#/tui/utils/interaction-mode-ui';

import { ChoicePickerComponent, type ChoiceOption } from './choice-picker';

const MODE_DESCRIPTIONS_EN: Record<InteractionMode, string> = {
  agent: 'Default coding assistant with full tool access.',
  plan: 'Plan first — explore and write a plan before editing.',
  debug: 'Troubleshooting mode with step timing details.',
  multitask: 'Run coordinated multitask / swarm agents.',
  ask: 'Read-only Q&A — answer questions without editing.',
};

const MODE_DESCRIPTIONS_ZH: Record<InteractionMode, string> = {
  agent: '默认编程助理，可使用全部工具。',
  plan: '先规划：探索并写计划，再动手改代码。',
  debug: '排障模式，展示步骤耗时等细节。',
  multitask: '集群 / 多智能体协同执行。',
  ask: '只读问答，回答问题但不改代码。',
};

function modeOptions(): ChoiceOption[] {
  const zh = preferChineseUi();
  const descriptions = zh ? MODE_DESCRIPTIONS_ZH : MODE_DESCRIPTIONS_EN;
  return INTERACTION_MODES.map((mode) => ({
    value: mode,
    label: interactionModeLabel(mode),
    description: descriptions[mode],
  }));
}

export interface ModeSelectorOptions {
  readonly currentValue: InteractionMode;
  readonly onSelect: (mode: InteractionMode) => void;
  readonly onCancel: () => void;
}

export class ModeSelectorComponent extends ChoicePickerComponent {
  constructor(opts: ModeSelectorOptions) {
    super({
      title: preferChineseUi() ? '选择交互模式' : 'Select interaction mode',
      options: modeOptions(),
      currentValue: opts.currentValue,
      onSelect: (value) => {
        if (isInteractionMode(value)) opts.onSelect(value);
      },
      onCancel: opts.onCancel,
    });
  }
}
