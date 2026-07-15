import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MONO_FONT,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_XTERM_THEME,
  normalizeFontFamily,
  resolveMonoFont,
  resolveTerminalFontSize,
  xtermThemeFromCssVars,
} from '../src/renderer/terminal-options';

describe('terminal-options', () => {
  it('normalizeFontFamily quotes names that contain spaces', () => {
    expect(normalizeFontFamily('MesloLGS NF')).toBe('"MesloLGS NF"');
    expect(normalizeFontFamily('MesloLGS NF, Menlo, monospace')).toBe(
      '"MesloLGS NF", Menlo, monospace',
    );
  });

  it('normalizeFontFamily keeps quoted tokens and keywords intact', () => {
    expect(normalizeFontFamily('"MesloLGS NF"')).toBe('"MesloLGS NF"');
    expect(normalizeFontFamily("'JetBrains Mono'")).toBe("'JetBrains Mono'");
    expect(normalizeFontFamily('ui-monospace, SFMono-Regular, monospace')).toBe(
      'ui-monospace, SFMono-Regular, monospace',
    );
    expect(normalizeFontFamily('ui-monospace, SFMono-Regular, Menlo, Monaco, "JetBrains Mono", monospace'))
      .toBe('ui-monospace, SFMono-Regular, Menlo, Monaco, "JetBrains Mono", monospace');
  });

  it('resolveMonoFont prefers settings.codeFont and normalizes it', () => {
    expect(resolveMonoFont({ codeFont: ' Menlo, monospace ' }, () => 'Courier')).toBe(
      'Menlo, monospace',
    );
    expect(resolveMonoFont({ codeFont: 'MesloLGS NF' })).toBe('"MesloLGS NF"');
  });

  it('resolveMonoFont falls back to CSS var then default stack', () => {
    expect(resolveMonoFont({ codeFont: '   ' }, () => '  JetBrains Mono  ')).toBe(
      '"JetBrains Mono"',
    );
    expect(resolveMonoFont({ codeFont: '' }, () => '   ')).toBe(DEFAULT_MONO_FONT);
    expect(resolveMonoFont({ codeFont: '' })).toBe(DEFAULT_MONO_FONT);
  });

  it('resolveTerminalFontSize clamps to 10–24', () => {
    expect(resolveTerminalFontSize({ terminalFontSize: 13 })).toBe(13);
    expect(resolveTerminalFontSize({ terminalFontSize: 9 })).toBe(10);
    expect(resolveTerminalFontSize({ terminalFontSize: 30 })).toBe(24);
    expect(resolveTerminalFontSize({ terminalFontSize: Number.NaN })).toBe(
      DEFAULT_TERMINAL_FONT_SIZE,
    );
  });

  it('xtermThemeFromCssVars uses provided colors with defaults', () => {
    expect(
      xtermThemeFromCssVars({
        background: ' #ffffff ',
        foreground: '#111',
        cursor: '',
      }),
    ).toEqual({
      background: '#ffffff',
      foreground: '#111',
      cursor: DEFAULT_XTERM_THEME.cursor,
    });
    expect(xtermThemeFromCssVars({})).toEqual(DEFAULT_XTERM_THEME);
  });
});
