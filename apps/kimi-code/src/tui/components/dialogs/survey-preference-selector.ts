import { t } from '#/tui/i18n';

import { ChoicePickerComponent, type ChoiceOption } from './choice-picker';

const SURVEY_PREFERENCE_OPTIONS: readonly ChoiceOption[] = [
  {
    value: 'on',
    label: 'On',
    description: 'Show the occasional rating prompt above the editor.',
  },
  {
    value: 'off',
    label: 'Off',
    description: 'Never show the rating prompt.',
  },
];

export interface SurveyPreferenceSelectorOptions {
  readonly currentValue: boolean;
  readonly onSelect: (value: boolean) => void;
  readonly onCancel: () => void;
}

export class SurveyPreferenceSelectorComponent extends ChoicePickerComponent {
  constructor(opts: SurveyPreferenceSelectorOptions) {
    super({
      title: t('Feedback survey'),
      options: SURVEY_PREFERENCE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
        description: option.description === undefined ? undefined : t(option.description),
      })),
      currentValue: opts.currentValue ? 'on' : 'off',
      onSelect: (value) => {
        opts.onSelect(value === 'on');
      },
      onCancel: opts.onCancel,
    });
  }
}
