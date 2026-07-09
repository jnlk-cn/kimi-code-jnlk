import { ChoicePickerComponent, type ChoiceOption } from './choice-picker';

const UPDATE_PREFERENCE_OPTIONS: readonly ChoiceOption[] = [
  {
    value: 'on',
    label: 'On',
    description: 'Install new versions silently in the background.',
  },
  {
    value: 'off',
    label: 'Off',
    description: 'Show an update prompt with one-click install.',
  },
];

export interface UpdatePreferenceSelectorOptions {
  readonly currentValue: boolean;
  readonly onSelect: (value: boolean) => void;
  readonly onCancel: () => void;
}

export class UpdatePreferenceSelectorComponent extends ChoicePickerComponent {
  constructor(opts: UpdatePreferenceSelectorOptions) {
    super({
      title: 'Automatic updates',
      options: [...UPDATE_PREFERENCE_OPTIONS],
      currentValue: opts.currentValue ? 'on' : 'off',
      onSelect: (value) => {
        opts.onSelect(value === 'on');
      },
      onCancel: opts.onCancel,
    });
  }
}
