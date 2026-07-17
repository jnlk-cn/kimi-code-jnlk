import type { AppSettings } from './contracts';

export const DEFAULT_ACCENT_DARK = '#4fa8ff';
export const DEFAULT_ACCENT_LIGHT = '#1565c0';

export type ResolvedTheme = 'dark' | 'light';

export function hexToRgbTriplet(hex: string): string | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (match?.[1] === undefined) return undefined;
  const value = Number.parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${String(r)}, ${String(g)}, ${String(b)}`;
}

export function resolveThemeMode(
  settings: Pick<AppSettings, 'theme'>,
  prefersLight = false,
): ResolvedTheme {
  if (settings.theme === 'system') {
    return prefersLight ? 'light' : 'dark';
  }
  return settings.theme;
}

export function resolveAccentColor(
  settings: Pick<AppSettings, 'theme' | 'accentDark' | 'accentLight'>,
  prefersLight = false,
): string {
  return resolveThemeMode(settings, prefersLight) === 'light'
    ? settings.accentLight
    : settings.accentDark;
}
