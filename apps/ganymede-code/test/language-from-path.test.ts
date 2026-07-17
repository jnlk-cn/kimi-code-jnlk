import { describe, expect, it } from 'vitest';

import {
  extensionOf,
  isHtmlPath,
  languageFromFence,
  languageFromPath,
} from '../src/renderer/language-from-path';

describe('languageFromPath', () => {
  it('maps common extensions', () => {
    expect(languageFromPath('src/app.tsx')).toBe('typescript');
    expect(languageFromPath('counter.html')).toBe('html');
    expect(languageFromPath('styles.css')).toBe('css');
    expect(languageFromPath('data.json')).toBe('json');
  });

  it('reads extension helpers', () => {
    expect(extensionOf('a/b/c.HTML')).toBe('html');
    expect(isHtmlPath('page.htm')).toBe(true);
    expect(isHtmlPath('page.ts')).toBe(false);
  });

  it('normalizes fence languages', () => {
    expect(languageFromFence('tsx')).toBe('typescript');
    expect(languageFromFence('bash')).toBe('shell');
    expect(languageFromFence('yml')).toBe('yaml');
  });
});
