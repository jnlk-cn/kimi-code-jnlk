import { describe, expect, it, vi } from 'vitest';

import type { ModelAlias } from '@moonshot-ai/kimi-code-sdk';

import { handleContextCommand } from '#/tui/commands/config';
import type { SlashCommandHost } from '#/tui/commands/dispatch';
import { SegmentedSelectorComponent } from '#/tui/components/dialogs/segmented-selector';
import {
  applyContextSize,
  contextSizeOptions,
  effectiveContextSize,
  parseContextSizeArg,
} from '#/tui/utils/context-size';

const deepSeek: ModelAlias = {
  provider: 'deepseek',
  model: 'deepseek-v4-pro',
  maxContextSize: 1_048_576,
  maxOutputSize: 393_216,
};

const smallWindow: ModelAlias = {
  provider: 'openai',
  model: 'small',
  maxContextSize: 204_800,
};

type MountedPanel = { handleInput: (data: string) => void; render: (width: number) => string[] };

function makeHost(model: ModelAlias, contextTokens = 0) {
  const state = {
    appState: {
      model: 'deepseek/deepseek-v4-pro',
      availableModels: { 'deepseek/deepseek-v4-pro': model } as Record<string, ModelAlias>,
      contextTokens,
      maxContextTokens: effectiveContextSize(model),
      streamingPhase: 'idle',
      isCompacting: false,
    },
  };
  let mounted: MountedPanel | null = null;
  const host = {
    state,
    harness: { setConfig: vi.fn(async () => ({})) },
    setAppState: vi.fn((patch: Record<string, unknown>) => Object.assign(state.appState, patch)),
    showStatus: vi.fn(),
    showError: vi.fn(),
    track: vi.fn(),
    mountEditorReplacement: vi.fn((panel: MountedPanel) => {
      mounted = panel;
    }),
    restoreEditor: vi.fn(() => {
      mounted = null;
    }),
    mounted: () => mounted,
  } as unknown as SlashCommandHost & {
    state: typeof state;
    harness: { setConfig: ReturnType<typeof vi.fn> };
    setAppState: ReturnType<typeof vi.fn>;
    showStatus: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
    track: ReturnType<typeof vi.fn>;
    mountEditorReplacement: ReturnType<typeof vi.fn>;
    restoreEditor: ReturnType<typeof vi.fn>;
    mounted: () => MountedPanel | null;
  };
  return host;
}

describe('context size helpers', () => {
  it('offers every preset up to the declared window, plus the current budget', () => {
    expect(contextSizeOptions(deepSeek)).toEqual([
      131_072, 262_144, 327_680, 524_288, 786_432, 1_048_576,
    ]);
    expect(contextSizeOptions({ ...deepSeek, maxInputSize: 262_144 })).toHaveLength(6);
    expect(contextSizeOptions(smallWindow)).toEqual([131_072, 204_800]);
  });

  it('reads the working budget from max_input_size and clamps it to the window', () => {
    expect(effectiveContextSize(deepSeek)).toBe(1_048_576);
    expect(effectiveContextSize({ ...deepSeek, maxInputSize: 262_144 })).toBe(262_144);
    expect(effectiveContextSize({ ...deepSeek, maxInputSize: 2_000_000 })).toBe(1_048_576);
  });

  it('parses the ladder spellings and rejects anything else', () => {
    expect(parseContextSizeArg('256k')).toBe(262_144);
    expect(parseContextSizeArg(' 1M ')).toBe(1_048_576);
    expect(parseContextSizeArg('320k')).toBe(327_680);
    expect(parseContextSizeArg('786432')).toBe(786_432);
    expect(parseContextSizeArg('999k')).toBeUndefined();
    expect(parseContextSizeArg('nope')).toBeUndefined();
    expect(parseContextSizeArg('')).toBeUndefined();
  });
});

describe('applyContextSize', () => {
  it('persists max_input_size and points the UI at the new window', async () => {
    const host = makeHost(deepSeek, 10_000);

    await applyContextSize(host, 262_144);

    expect(host.harness.setConfig).toHaveBeenCalledWith({
      models: { 'deepseek/deepseek-v4-pro': { maxInputSize: 262_144 } },
    });
    expect(host.setAppState).toHaveBeenCalledWith(
      expect.objectContaining({ maxContextTokens: 262_144 }),
    );
    expect(host.state.appState.availableModels['deepseek/deepseek-v4-pro']?.maxInputSize).toBe(
      262_144,
    );
    expect(host.showStatus).toHaveBeenCalledWith(
      expect.stringContaining('256k'),
      'success',
    );
    expect(host.showError).not.toHaveBeenCalled();
  });

  it('warns that the next step compacts when usage already exceeds the new budget', async () => {
    const host = makeHost(deepSeek, 300_000);

    await applyContextSize(host, 131_072);

    expect(host.showStatus).toHaveBeenLastCalledWith(
      expect.stringContaining('already exceeds that budget'),
      'warning',
    );
  });

  it('reports an unchanged budget without writing config again', async () => {
    const host = makeHost({ ...deepSeek, maxInputSize: 262_144 });

    await applyContextSize(host, 262_144);

    expect(host.harness.setConfig).not.toHaveBeenCalled();
    expect(host.showStatus).toHaveBeenCalledWith(
      expect.stringContaining('Already using'),
      'success',
    );
  });

  it('surfaces a config write failure instead of pretending the switch landed', async () => {
    const host = makeHost(deepSeek);
    host.harness.setConfig.mockRejectedValueOnce(new Error('disk full'));

    await applyContextSize(host, 327_680);

    expect(host.showError).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    expect(host.state.appState.maxContextTokens).toBe(1_048_576);
  });
});

describe('handleContextCommand', () => {
  it('mounts the segmented picker over the preset ladder', async () => {
    const host = makeHost(deepSeek);

    await handleContextCommand(host, '');

    const picker = host.mounted();
    expect(picker).toBeInstanceOf(SegmentedSelectorComponent);
    expect(picker?.render(120).join('\n')).toContain('[ 1M ]');

    const fromOneM = picker as unknown as SegmentedSelectorComponent;
    fromOneM.handleInput(`${String.fromCodePoint(27)}[D`);
    fromOneM.handleInput('\r');
    expect(host.harness.setConfig).toHaveBeenCalledWith({
      models: { 'deepseek/deepseek-v4-pro': { maxInputSize: 786_432 } },
    });
  });

  it('applies an argument directly and rejects an unknown size', async () => {
    const host = makeHost(deepSeek);

    await handleContextCommand(host, '320k');
    expect(host.harness.setConfig).toHaveBeenCalledWith({
      models: { 'deepseek/deepseek-v4-pro': { maxInputSize: 327_680 } },
    });

    await handleContextCommand(host, '999k');
    expect(host.showError).toHaveBeenCalledWith(expect.stringContaining('999k'));
  });

  it('refuses a budget larger than the declared window', async () => {
    const host = makeHost(smallWindow);
    host.state.appState.model = 'deepseek/deepseek-v4-pro';
    host.state.appState.availableModels = { 'deepseek/deepseek-v4-pro': smallWindow };

    await handleContextCommand(host, '1m');

    expect(host.harness.setConfig).not.toHaveBeenCalled();
    expect(host.showError).toHaveBeenCalledWith(expect.stringContaining('200k'));
  });
});
