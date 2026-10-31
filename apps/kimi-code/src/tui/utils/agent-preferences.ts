/**
 * Writes the language / shell preference into the global AGENTS.md as a marked,
 * advisory block. The agent reads the file as part of its profile, so the
 * preference is a hint it can weigh — never an enforced setting.
 */

export const PREFERENCE_BLOCK_START = '<!-- ganycode:preferences:start -->';
export const PREFERENCE_BLOCK_END = '<!-- ganycode:preferences:end -->';

export interface AgentPreferences {
  readonly language?: 'auto' | 'en' | 'zh-CN';
  readonly terminalPreference?: 'default' | 'bash' | 'powershell' | 'powershell7';
}

const LANGUAGE_LINES: Readonly<Record<'en' | 'zh-CN', string>> = {
  en: 'Reply in English.',
  'zh-CN': 'Reply in Simplified Chinese (简体中文).',
};

const KEEP_VERBATIM =
  'Keep code, commands, file paths, identifiers, and quoted error output exactly as written, in English.';

const TERMINAL_LINES: Readonly<Record<string, string>> = {
  bash: 'Prefer bash (Git Bash on Windows) for shell commands.',
  powershell: 'Prefer the built-in powershell.exe for shell commands.',
  powershell7: 'Prefer PowerShell 7 (pwsh) for shell commands.',
};

export function renderPreferenceBlock(preferences: AgentPreferences): string | undefined {
  const lines: string[] = [];
  const language = preferences.language;
  if (language !== undefined && language !== 'auto') {
    lines.push(`- ${LANGUAGE_LINES[language]}`);
    lines.push(`- ${KEEP_VERBATIM}`);
  }
  const terminal = preferences.terminalPreference;
  if (terminal !== undefined && terminal !== 'default') {
    lines.push(`- ${TERMINAL_LINES[terminal] ?? `Prefer ${terminal} for shell commands.`}`);
  }
  if (lines.length === 0) return undefined;
  return [
    PREFERENCE_BLOCK_START,
    '## GanyCode preferences',
    '',
    'These are user preferences, not hard rules. Follow them unless doing so would break the task.',
    '',
    ...lines,
    PREFERENCE_BLOCK_END,
  ].join('\n');
}

/** Replaces the marked block, or appends it, leaving the rest of the file intact. */
export function applyPreferenceBlock(existing: string, block: string | undefined): string {
  const start = existing.indexOf(PREFERENCE_BLOCK_START);
  const end = existing.indexOf(PREFERENCE_BLOCK_END);
  const hasBlock = start !== -1 && end !== -1 && end > start;
  const withoutBlock = hasBlock
    ? `${existing.slice(0, start)}${existing.slice(end + PREFERENCE_BLOCK_END.length)}`
    : existing;
  if (block === undefined) {
    return hasBlock ? withoutBlock.replaceAll(/\n{3,}/g, '\n\n').trimEnd() + '\n' : existing;
  }
  const trimmed = withoutBlock.trimEnd();
  return trimmed.length === 0 ? `${block}\n` : `${trimmed}\n\n${block}\n`;
}
