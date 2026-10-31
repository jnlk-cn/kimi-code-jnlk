import { describe, expect, it } from 'vitest';

import { parseTuiConfig } from '#/tui/config';
import { resolveUiLanguage } from '#/tui/i18n';

describe('language preference round trip', () => {
  it('parses the language and hands it to the UI language resolver', () => {
    const config = parseTuiConfig('language = "zh-CN"\n');
    expect(config.language).toBe('zh-CN');
    expect(resolveUiLanguage(config.language)).toBe('zh-CN');
  });

  it('defaults to auto so the startup path keeps matching the user', () => {
    const config = parseTuiConfig('');
    expect(config.language).toBe('auto');
  });

  it('falls back to auto when the value is not a supported language', () => {
    const warnings: string[] = [];
    const config = parseTuiConfig('language = "fr"\n', (message) => warnings.push(message));
    expect(config.language).toBe('auto');
    expect(warnings.some((message) => message.includes('language'))).toBe(true);
  });

  it('parses the terminal shell hint', () => {
    const config = parseTuiConfig('[terminal]\npreference = "powershell7"\n');
    expect(config.terminalPreference).toBe('powershell7');
    expect(parseTuiConfig('').terminalPreference).toBe('default');
  });
});
