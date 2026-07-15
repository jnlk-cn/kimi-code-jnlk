import type { AppSettings } from '../shared/contracts';

export const DEFAULT_MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, "JetBrains Mono", monospace';

export const DEFAULT_TERMINAL_FONT_SIZE = 13;

export interface XtermThemeColors {
  readonly background: string;
  readonly foreground: string;
  readonly cursor: string;
}

export const DEFAULT_XTERM_THEME: XtermThemeColors = {
  background: '#101114',
  foreground: '#f1f3f7',
  cursor: '#7c8cff',
};

/** Quote font-family tokens that contain whitespace so stacks like MesloLGS NF parse correctly. */
export function normalizeFontFamily(value: string): string {
  return value
    .split(',')
    .map((part) => normalizeFontFamilyToken(part.trim()))
    .filter((part) => part.length > 0)
    .join(', ');
}

function normalizeFontFamilyToken(token: string): string {
  if (token.length === 0) return token;
  if (
    (token.startsWith('"') && token.endsWith('"'))
    || (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token;
  }
  if (/\s/.test(token)) {
    return `"${token.replaceAll('"', '\\"')}"`;
  }
  return token;
}

export function resolveMonoFont(
  settings: Pick<AppSettings, 'codeFont'>,
  readCssVar?: () => string,
): string {
  const fromSettings = settings.codeFont.trim();
  if (fromSettings.length > 0) return normalizeFontFamily(fromSettings);
  const fromCss = readCssVar?.().trim() ?? '';
  if (fromCss.length > 0) return normalizeFontFamily(fromCss);
  return DEFAULT_MONO_FONT;
}

export function resolveTerminalFontSize(settings: Pick<AppSettings, 'terminalFontSize'>): number {
  const size = settings.terminalFontSize;
  if (!Number.isFinite(size)) return DEFAULT_TERMINAL_FONT_SIZE;
  return Math.min(24, Math.max(10, Math.round(size)));
}

export function xtermThemeFromCssVars(vars: {
  readonly background?: string;
  readonly foreground?: string;
  readonly cursor?: string;
}): XtermThemeColors {
  return {
    background: vars.background?.trim() || DEFAULT_XTERM_THEME.background,
    foreground: vars.foreground?.trim() || DEFAULT_XTERM_THEME.foreground,
    cursor: vars.cursor?.trim() || DEFAULT_XTERM_THEME.cursor,
  };
}

export function readTerminalThemeFromDocument(doc: Document = document): XtermThemeColors {
  const style = getComputedStyle(doc.documentElement);
  return xtermThemeFromCssVars({
    background: style.getPropertyValue('--bg'),
    foreground: style.getPropertyValue('--text'),
    cursor: style.getPropertyValue('--accent'),
  });
}
