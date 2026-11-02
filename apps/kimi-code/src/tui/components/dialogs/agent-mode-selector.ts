import { t } from '#/tui/i18n';
import type { AgentMode } from '#/tui/utils/agent-mode';

import { ChoicePickerComponent, type ChoiceOption } from './choice-picker';

function agentModeOptions(): readonly ChoiceOption[] {
  return [
    {
      value: 'agent',
      label: t('Agent'),
      description: t('Read and edit files, run commands, and carry the task through.'),
    },
    {
      value: 'plan',
      label: t('Plan'),
      description: t('Plan first: propose an approach and wait for approval before changing files.'),
    },
    {
      value: 'ask',
      label: t('Ask'),
      description: t('Read-only Q&A: explain the code without changing files or running commands.'),
    },
    {
      value: 'debug',
      label: t('Debug'),
      description: t('Debug with evidence: reproduce, instrument, fix the root cause, then verify.'),
    },
  ];
}

function isAgentModeChoice(value: string): value is AgentMode {
  return value === 'agent' || value === 'plan' || value === 'ask' || value === 'debug';
}

export interface AgentModeSelectorOptions {
  readonly currentValue: AgentMode;
  readonly onSelect: (mode: AgentMode) => void;
  readonly onCancel: () => void;
}

export class AgentModeSelectorComponent extends ChoicePickerComponent {
  constructor(opts: AgentModeSelectorOptions) {
    super({
      title: t('Select agent mode'),
      options: agentModeOptions(),
      currentValue: opts.currentValue,
      onSelect: (value) => {
        if (isAgentModeChoice(value)) opts.onSelect(value);
      },
      onCancel: opts.onCancel,
    });
  }
}
