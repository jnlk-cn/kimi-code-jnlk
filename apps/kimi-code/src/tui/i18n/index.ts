/**
 * TUI copy translation.
 *
 * The dictionary is keyed by the English source string so call sites stay
 * readable and an untranslated string falls back to English instead of
 * rendering a raw key.
 */

import { ZH_CN_DICTIONARY } from './zh-CN';

export type UiLanguage = 'en' | 'zh-CN';

export const UI_LANGUAGES: readonly UiLanguage[] = ['en', 'zh-CN'];

let currentLanguage: UiLanguage = 'en';

const dictionaries: Record<UiLanguage, Readonly<Record<string, string>>> = {
  en: {},
  'zh-CN': ZH_CN_DICTIONARY,
};

export function registerDictionary(
  language: UiLanguage,
  entries: Readonly<Record<string, string>>,
): void {
  dictionaries[language] = entries;
}

export function setUiLanguage(language: UiLanguage): void {
  currentLanguage = language;
}

export function getUiLanguage(): UiLanguage {
  return currentLanguage;
}

/** Maps the tui.toml preference onto a concrete UI language. */
export function resolveUiLanguage(preference: 'auto' | UiLanguage | undefined): UiLanguage {
  if (preference === 'en' || preference === 'zh-CN') return preference;
  const locale = (process.env['LC_ALL'] ?? process.env['LC_MESSAGES'] ?? process.env['LANG'] ?? '')
    .toLowerCase();
  return locale.startsWith('zh') ? 'zh-CN' : 'en';
}

export function t(english: string): string {
  const dictionary = dictionaries[currentLanguage];
  const translated = dictionary[english];
  return translated === undefined || translated.length === 0 ? english : translated;
}

/** Fill `{name}` placeholders after translation. */
export function tFormat(english: string, values: Readonly<Record<string, string | number>>): string {
  return t(english).replaceAll(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}
