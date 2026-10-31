import { t } from '#/tui/i18n';

import { ChoicePickerComponent, type ChoiceOption } from './choice-picker';
import type { ConversationLanguage } from '../../config';

const LANGUAGE_OPTIONS: readonly ChoiceOption[] = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Reply in whatever language you write in.',
  },
  {
    value: 'zh-CN',
    label: '简体中文',
    description: 'Reply in Simplified Chinese; code, commands, and paths stay as written.',
  },
  {
    value: 'en',
    label: 'English',
    description: 'Reply in English.',
  },
];

export interface LanguageSelectorOptions {
  readonly currentValue: ConversationLanguage;
  readonly onSelect: (value: ConversationLanguage) => void;
  readonly onCancel: () => void;
}

export class LanguageSelectorComponent extends ChoicePickerComponent {
  constructor(opts: LanguageSelectorOptions) {
    super({
      title: t('Reply language'),
      options: LANGUAGE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
        description: option.description === undefined ? undefined : t(option.description),
      })),
      currentValue: opts.currentValue,
      onSelect: (value) => {
        opts.onSelect(value as ConversationLanguage);
      },
      onCancel: opts.onCancel,
    });
  }
}
