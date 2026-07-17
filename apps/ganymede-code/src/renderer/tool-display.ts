import { isHtmlPath, languageFromPath } from './language-from-path';

export type ToolDisplayMode = 'write' | 'edit' | 'json' | 'raw';

export interface ToolDisplay {
  readonly mode: ToolDisplayMode;
  readonly path?: string;
  readonly language?: string;
  readonly code: string;
  readonly previewable: boolean;
}

const TOOL_RESULT_LINE =
  /^(?:Wrote|Appended)\s+\d+\s+bytes\s+to\s+.+$|^(?:Replaced)\s+\d+\s+occurrences?\s+in\s+.+$|^(?:Updated)\s+.+$/i;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function textField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function tryParseJson(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.length === 0) return undefined;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function extractWriteLike(record: Record<string, unknown>): ToolDisplay | undefined {
  const path = textField(record, 'path') ?? textField(record, 'file_path') ?? textField(record, 'filePath');
  const content = textField(record, 'content') ?? textField(record, 'contents') ?? textField(record, 'new_string');
  if (path === undefined || content === undefined) return undefined;
  const hasOld = textField(record, 'old_string') !== undefined || textField(record, 'oldString') !== undefined;
  const mode: ToolDisplayMode = hasOld || textField(record, 'new_string') !== undefined ? 'edit' : 'write';
  return {
    mode,
    path,
    language: languageFromPath(path),
    code: content,
    previewable: isHtmlPath(path),
  };
}

function extractNestedArgs(parsed: unknown): Record<string, unknown> | undefined {
  const root = asRecord(parsed);
  if (root === undefined) return undefined;
  const fn = asRecord(root['function']);
  if (fn !== undefined) {
    const args = fn['arguments'];
    if (typeof args === 'string') {
      const nested = tryParseJson(args);
      return asRecord(nested) ?? undefined;
    }
    return asRecord(args);
  }
  const args = root['args'] ?? root['arguments'] ?? root['input'];
  if (typeof args === 'string') {
    const nested = tryParseJson(args);
    return asRecord(nested) ?? root;
  }
  return asRecord(args) ?? root;
}

/** Strip trailing tool-result status lines so mixed args+result content can parse as JSON. */
export function stripToolResultSuffix(content: string): string {
  const lines = content.split('\n');
  while (lines.length > 0) {
    const last = lines.at(-1)?.trim() ?? '';
    if (last.length === 0 || TOOL_RESULT_LINE.test(last)) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join('\n').trimEnd();
}

/**
 * Prefer the richest Write/Edit payload when content mixes args + result lines.
 * Falls back to pretty JSON or raw text.
 */
export function parseToolDisplay(content: string, streaming = false): ToolDisplay {
  if (streaming) {
    return {
      mode: 'raw',
      language: 'json',
      code: content,
      previewable: false,
    };
  }

  const stripped = stripToolResultSuffix(content);
  const sources = stripped !== content && stripped.length > 0 ? [stripped, content] : [content];

  for (const source of sources) {
    const candidates = [source, ...source.split(/\n(?=\{)/).filter((part) => part.trim().startsWith('{'))];
    for (const candidate of candidates) {
      const parsed = tryParseJson(candidate);
      if (parsed === undefined) continue;
      const record = extractNestedArgs(parsed) ?? asRecord(parsed);
      if (record === undefined) continue;
      const writeLike = extractWriteLike(record);
      if (writeLike !== undefined) return writeLike;
    }

    const parsed = tryParseJson(source);
    if (parsed !== undefined) {
      try {
        return {
          mode: 'json',
          language: 'json',
          code: JSON.stringify(parsed, null, 2),
          previewable: false,
        };
      } catch {
        // fall through
      }
    }
  }

  const pathMatch = /"(?:path|file_path|filePath)"\s*:\s*"([^"]+)"/.exec(stripped.length > 0 ? stripped : content);
  const path = pathMatch?.[1];
  return {
    mode: 'raw',
    path,
    language: path !== undefined ? languageFromPath(path) : undefined,
    code: stripped.length > 0 ? stripped : content,
    previewable: path !== undefined && isHtmlPath(path),
  };
}

/**
 * Prefer structured toolArgs (survives tool.result overwrite/append), then fall back to content.
 */
export function parseToolDisplayFromEntry(entry: {
  readonly content: string;
  readonly toolArgs?: Record<string, unknown>;
  readonly streaming?: boolean;
}): ToolDisplay {
  const streaming = entry.streaming === true;
  if (streaming) {
    return parseToolDisplay(entry.content, true);
  }

  if (entry.toolArgs !== undefined) {
    const fromArgs = extractWriteLike(entry.toolArgs);
    if (fromArgs !== undefined) return fromArgs;
  }

  return parseToolDisplay(entry.content, false);
}

export function toolDisplayTitle(display: ToolDisplay): string | undefined {
  if (display.path === undefined) return undefined;
  if (display.mode === 'write') return `写入 ${display.path}`;
  if (display.mode === 'edit') return `编辑 ${display.path}`;
  return display.path;
}

export function fileTypeBadge(path: string | undefined): string | undefined {
  if (path === undefined) return undefined;
  const base = path.split(/[/\\]/).at(-1) ?? path;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return undefined;
  const ext = base.slice(dot + 1);
  if (ext.length === 0 || ext.length > 5) return undefined;
  return ext.toUpperCase();
}
