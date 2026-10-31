/**
 * TUI copy translation.
 *
 * The dictionary is keyed by the English source string so call sites stay
 * readable and an untranslated string falls back to English instead of
 * rendering a raw key.
 */

import { FRAGMENT as GROUP_A } from './fragments/group-a';
import { FRAGMENT as GROUP_B } from './fragments/group-b';
import { FRAGMENT as GROUP_C } from './fragments/group-c';
import { FRAGMENT as GROUP_D } from './fragments/group-d';
import { FRAGMENT as GROUP_E } from './fragments/group-e';
import { FRAGMENT as GROUP_F } from './fragments/group-f';
import { FRAGMENT as GROUP_G } from './fragments/group-g';
import { FRAGMENT as GROUP_H } from './fragments/group-h';
import { FRAGMENT as GROUP_I } from './fragments/group-i';
import { FRAGMENT as GROUP_J } from './fragments/group-j';
import { FRAGMENT as GROUP_K } from './fragments/group-k';
import { FRAGMENT as GROUP_L } from './fragments/group-l';
import { FRAGMENT as GROUP_M } from './fragments/group-m';
import { FRAGMENT as GROUP_N } from './fragments/group-n';
import { FRAGMENT as GROUP_O } from './fragments/group-o';
import { FRAGMENT as GROUP_P } from './fragments/group-p';
import { FRAGMENT as GROUP_Q } from './fragments/group-q';
import { FRAGMENT as GROUP_R } from './fragments/group-r';
import { FRAGMENT as GROUP_S } from './fragments/group-s';
import { FRAGMENT as GROUP_T } from './fragments/group-t';
import { FRAGMENT as GROUP_U } from './fragments/group-u';
import { FRAGMENT as GROUP_V } from './fragments/group-v';
import { FRAGMENT as GROUP_W } from './fragments/group-w';
import { FRAGMENT as GROUP_X } from './fragments/group-x';
import { ZH_CN_DICTIONARY } from './zh-CN';

export type UiLanguage = 'en' | 'zh-CN';

export const UI_LANGUAGES: readonly UiLanguage[] = ['en', 'zh-CN'];

let currentLanguage: UiLanguage = 'en';

const dictionaries: Record<UiLanguage, Readonly<Record<string, string>>> = {
  en: {},
  'zh-CN': {
    ...ZH_CN_DICTIONARY,
    ...GROUP_A,
    ...GROUP_B,
    ...GROUP_C,
    ...GROUP_D,
    ...GROUP_E,
    ...GROUP_F,
    ...GROUP_G,
    ...GROUP_H,
    ...GROUP_I,
    ...GROUP_J,
    ...GROUP_K,
    ...GROUP_L,
    ...GROUP_M,
    ...GROUP_N,
    ...GROUP_O,
    ...GROUP_P,
    ...GROUP_Q,
    ...GROUP_R,
    ...GROUP_S,
    ...GROUP_T,
    ...GROUP_U,
    ...GROUP_V,
    ...GROUP_W,
    ...GROUP_X,
  },
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
