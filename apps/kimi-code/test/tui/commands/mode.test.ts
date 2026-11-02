import { describe, expect, it, vi } from 'vitest';

import type { SlashCommandHost } from '#/tui/commands/dispatch';
import { handleAskCommand, handleDebugCommand, handleModeCommand } from '#/tui/commands/index';
import { currentTheme } from '#/tui/theme';

interface TestComponent {
  handleInput(data: string): void;
  render(width: number): string[];
}

function makeHost(
  overrides: {
    planMode?: boolean;
    askMode?: boolean;
    debugMode?: boolean;
    hasSession?: boolean;
  } = {},
) {
  const session = {
    setPlanMode: vi.fn(async () => {}),
    setAskMode: vi.fn(async () => {}),
    setDebugMode: vi.fn(async () => {}),
    getPlan: vi.fn(async () => ({ id: 'plan-1', content: '', path: '/tmp/plan.md' })),
  };
  const host = {
    state: {
      appState: {
        planMode: overrides.planMode ?? false,
        askMode: overrides.askMode ?? false,
        debugMode: overrides.debugMode ?? false,
      },
      theme: currentTheme,
      transcriptContainer: { addChild: vi.fn() },
      ui: { requestRender: vi.fn() },
    },
    session: overrides.hasSession === false ? undefined : session,
    setAppState: vi.fn((patch: Record<string, unknown>) => {
      Object.assign(host.state.appState, patch);
    }),
    showError: vi.fn(),
    showNotice: vi.fn(),
    showStatus: vi.fn(),
    mountEditorReplacement: vi.fn(),
    restoreEditor: vi.fn(),
    restoreInputText: vi.fn(),
    track: vi.fn(),
  } as unknown as SlashCommandHost;
  return { host, session };
}

function mountedPicker(host: SlashCommandHost): TestComponent {
  const mock = host.mountEditorReplacement as ReturnType<typeof vi.fn>;
  return mock.mock.calls[0]?.[0] as TestComponent;
}

describe('agent mode commands', () => {
  it('enters Ask mode and clears the other mode flags', async () => {
    const { host, session } = makeHost({ planMode: true });
    await handleAskCommand(host, '');

    expect(session.setAskMode).toHaveBeenCalledWith(true);
    expect(host.state.appState).toMatchObject({ planMode: false, askMode: true, debugMode: false });
    expect(host.showNotice).toHaveBeenCalledWith(
      expect.stringContaining('Ask'),
      expect.stringContaining('read-only'),
    );
  });

  it('returns to Agent mode when Ask mode is toggled off', async () => {
    const { host, session } = makeHost({ askMode: true });
    await handleAskCommand(host, 'off');

    expect(session.setAskMode).toHaveBeenCalledWith(false);
    expect(host.state.appState).toMatchObject({ planMode: false, askMode: false, debugMode: false });
  });

  it('reports Ask mode already off without touching the session', async () => {
    const { host, session } = makeHost();
    await handleAskCommand(host, 'off');

    expect(session.setAskMode).not.toHaveBeenCalled();
    expect(host.showNotice).toHaveBeenCalledWith(expect.stringContaining('already off'));
  });

  it('enters Debug mode with /debug on', async () => {
    const { host, session } = makeHost({ askMode: true });
    await handleDebugCommand(host, 'on');

    expect(session.setDebugMode).toHaveBeenCalledWith(true);
    expect(host.state.appState).toMatchObject({ planMode: false, askMode: false, debugMode: true });
  });

  it('rejects unknown subcommands', async () => {
    const { host, session } = makeHost();
    await handleDebugCommand(host, 'maybe');

    expect(session.setDebugMode).not.toHaveBeenCalled();
    expect(host.showError).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
  });

  it('enters Plan mode from the /mode picker', async () => {
    const { host, session } = makeHost();
    handleModeCommand(host, '');

    const picker = mountedPicker(host);
    expect(picker).toBeDefined();
    picker.handleInput('\u001B[B');
    picker.handleInput('\r');
    await vi.waitFor(() => expect(session.setPlanMode).toHaveBeenCalledWith(true));
    await vi.waitFor(() =>
      expect(host.state.appState).toMatchObject({ planMode: true, askMode: false, debugMode: false }),
    );
    expect(host.restoreEditor).toHaveBeenCalled();
  });

  it('requires an active session', async () => {
    const { host } = makeHost({ hasSession: false });
    await handleAskCommand(host, '');
    expect(host.showError).toHaveBeenCalledWith(expect.stringContaining('No active session'));
  });
});
