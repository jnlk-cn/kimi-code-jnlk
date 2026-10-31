import { afterEach, describe, expect, it } from 'vitest';

import { WelcomeComponent } from '#/tui/components/chrome/welcome';
import { getUiLanguage, setUiLanguage } from '#/tui/i18n';
import { darkColors } from '#/tui/theme/colors';
import { currentTheme } from '#/tui/theme';

function strip(text: string): string {
  return text.replaceAll(/\u001B\[[0-9;]*m/g, '');
}

function makeWelcome(): WelcomeComponent {
  return new WelcomeComponent({
    version: '2.4.0-jnlk.0',
    workDir: '/tmp/project',
    sessionId: '',
    model: 'deepseek-v4-pro',
    mcpServersSummary: '',
    availableModels: {},
    loggedOut: false,
  } as never);
}

afterEach(() => {
  setUiLanguage('en');
  currentTheme.setPalette(darkColors);
});

describe('welcome banner language', () => {
  it('shows the fork product name in Chinese once the UI language is set', () => {
    currentTheme.setPalette(darkColors);
    setUiLanguage('zh-CN');
    expect(getUiLanguage()).toBe('zh-CN');
    const output = makeWelcome()
      .render(120)
      .map(strip)
      .join('\n');
    expect(output).toContain('欢迎使用 GanyCode');
    expect(output).not.toContain('Welcome to Kimi Code');
    expect(output).toContain('目录：');
  });

  it('keeps the English source string in English mode', () => {
    currentTheme.setPalette(darkColors);
    setUiLanguage('en');
    const output = makeWelcome()
      .render(120)
      .map(strip)
      .join('\n');
    expect(output).toContain('Welcome to Kimi Code!');
  });
});
