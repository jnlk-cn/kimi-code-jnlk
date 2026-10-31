import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyLanguageChoice, applyTerminalPreferenceChoice } from '#/tui/commands/config';
import { getUiLanguage, setUiLanguage } from '#/tui/i18n';
import { darkColors } from '#/tui/theme/colors';

const mocks = vi.hoisted(() => ({
  saveTuiConfig: vi.fn(),
  writeAgentPreferences: vi.fn(),
}));

vi.mock('../../../src/tui/config', async () => {
  const actual = await vi.importActual<typeof import('../../../src/tui/config.js')>(
    '../../../src/tui/config.js',
  );
  return { ...actual, saveTuiConfig: mocks.saveTuiConfig };
});

vi.mock('../../../src/tui/utils/agent-preferences-io', () => ({
  writeAgentPreferences: mocks.writeAgentPreferences,
}));

function makeHost(overrides: { language?: 'auto' | 'en' | 'zh-CN'; terminalPreference?: string } = {}) {
  return {
    state: {
      appState: {
        theme: 'auto' as const,
        editorCommand: null,
        notifications: { enabled: true, condition: 'unfocused' as const },
        upgrade: { autoInstall: true },
        markdown: { mermaid: 'final' as const },
        language: overrides.language ?? 'auto',
        terminalPreference: overrides.terminalPreference ?? 'default',
      },
      theme: { palette: darkColors },
      transcriptContainer: { invalidate: vi.fn() },
      ui: { requestRender: vi.fn() },
    },
    setAppState: vi.fn(),
    showStatus: vi.fn(),
  };
}

afterEach(() => {
  mocks.saveTuiConfig.mockClear();
  mocks.writeAgentPreferences.mockClear();
  setUiLanguage('en');
});

describe('language preference command', () => {
  it('persists the choice and applies it to the running UI without a restart', async () => {
    const host = makeHost({ language: 'auto' });
    expect(getUiLanguage()).toBe('en');

    await applyLanguageChoice(host as never, 'zh-CN');

    expect(mocks.saveTuiConfig).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'zh-CN' }),
    );
    expect(mocks.writeAgentPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'zh-CN' }),
    );
    expect(getUiLanguage()).toBe('zh-CN');
    expect(host.state.ui.requestRender).toHaveBeenCalledWith(true);
  });

  it('does nothing when the language is unchanged', async () => {
    const host = makeHost({ language: 'zh-CN' });
    await applyLanguageChoice(host as never, 'zh-CN');
    expect(mocks.saveTuiConfig).not.toHaveBeenCalled();
    expect(host.showStatus).toHaveBeenCalledWith('Reply language already zh-CN.');
  });
});

describe('terminal preference command', () => {
  it('persists the shell hint and reports it as advisory', async () => {
    const host = makeHost({ terminalPreference: 'default' });

    await applyTerminalPreferenceChoice(host as never, 'powershell7');

    expect(mocks.saveTuiConfig).toHaveBeenCalledWith(
      expect.objectContaining({ terminalPreference: 'powershell7' }),
    );
    expect(mocks.writeAgentPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ terminalPreference: 'powershell7' }),
    );
    expect(host.showStatus).toHaveBeenCalledWith(
      expect.stringContaining('a hint for the agent, not enforced'),
    );
  });

  it('clears the hint when switching back to the default', async () => {
    const host = makeHost({ terminalPreference: 'bash' });
    await applyTerminalPreferenceChoice(host as never, 'default');
    expect(host.showStatus).toHaveBeenCalledWith(
      'Shell preference cleared; the agent picks the shell itself.',
    );
  });
});
