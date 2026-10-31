import { afterEach, describe, expect, it } from 'vitest';

import { BUILTIN_SLASH_COMMANDS } from '#/tui/commands/registry';
import {
  getUiLanguage,
  resolveUiLanguage,
  setUiLanguage,
  t,
  tFormat,
  type UiLanguage,
} from '#/tui/i18n';

const original = getUiLanguage();

afterEach(() => {
  setUiLanguage(original);
});

describe('tui i18n', () => {
  it('falls back to the English source string when a translation is missing', () => {
    setUiLanguage('zh-CN');
    expect(t('This string is deliberately untranslated.')).toBe(
      'This string is deliberately untranslated.',
    );
  });

  it('translates known copy once the language is switched', () => {
    setUiLanguage('en');
    expect(t('Slash commands')).toBe('Slash commands');
    setUiLanguage('zh-CN');
    expect(t('Slash commands')).toBe('斜杠命令');
  });

  it('fills placeholders after translation', () => {
    expect(tFormat('showing {from}-{to} of {total}', { from: 1, to: 3, total: 9 })).toBe(
      'showing 1-3 of 9',
    );
  });

  it('resolves auto from the locale environment', () => {
    const env = process.env;
    const saved = { LC_ALL: env['LC_ALL'], LC_MESSAGES: env['LC_MESSAGES'], LANG: env['LANG'] };
    try {
      delete env['LC_ALL'];
      delete env['LC_MESSAGES'];
      env['LANG'] = 'zh_CN.UTF-8';
      expect(resolveUiLanguage('auto')).toBe('zh-CN');
      env['LANG'] = 'en_US.UTF-8';
      expect(resolveUiLanguage('auto')).toBe('en');
      expect(resolveUiLanguage('zh-CN')).toBe('zh-CN');
      expect(resolveUiLanguage(undefined)).toBe('en');
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete env[key];
        else env[key] = value;
      }
    }
  });

  it('translates every built-in slash command description', () => {
    setUiLanguage('zh-CN');
    const untranslated = BUILTIN_SLASH_COMMANDS.filter(
      (command) => t(command.description) === command.description,
    ).map((command) => `/${command.name}: ${command.description}`);
    expect(untranslated).toEqual([]);
  });

  it('keeps the language type closed', () => {
    const languages: readonly UiLanguage[] = ['en', 'zh-CN'];
    expect(languages).toHaveLength(2);
  });
});
