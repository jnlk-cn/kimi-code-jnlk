import { ChoicePickerComponent, type ChoiceOption } from './choice-picker';
import type { TerminalPreference } from '../../config';

const TERMINAL_OPTIONS: readonly ChoiceOption[] = [
  {
    value: 'default',
    label: 'Default',
    description: 'Let the agent pick the shell it works best with.',
  },
  {
    value: 'bash',
    label: 'Bash',
    description: 'Prefer bash (Git Bash on Windows) for shell commands.',
  },
  {
    value: 'powershell',
    label: 'Windows PowerShell',
    description: 'Prefer the built-in powershell.exe for shell commands.',
  },
  {
    value: 'powershell7',
    label: 'PowerShell 7',
    description: 'Prefer pwsh for shell commands.',
  },
];

export interface TerminalPreferenceSelectorOptions {
  readonly currentValue: TerminalPreference;
  readonly onSelect: (value: TerminalPreference) => void;
  readonly onCancel: () => void;
}

export class TerminalPreferenceSelectorComponent extends ChoicePickerComponent {
  constructor(opts: TerminalPreferenceSelectorOptions) {
    super({
      title: 'Preferred shell (a hint for the agent, not enforced)',
      options: [...TERMINAL_OPTIONS],
      currentValue: opts.currentValue,
      onSelect: (value) => {
        opts.onSelect(value as TerminalPreference);
      },
      onCancel: opts.onCancel,
    });
  }
}
