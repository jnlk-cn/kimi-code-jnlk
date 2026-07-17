export interface ToolChangeStats {
  readonly additions: number;
  readonly deletions: number;
}

export type DiffLineKind = 'add' | 'delete';

export interface DiffLine {
  readonly kind: DiffLineKind;
  readonly text: string;
}

function strArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === 'string' ? value : '';
}

function splitContentLines(content: string): readonly string[] {
  const normalized = content.endsWith('\n') ? content.slice(0, -1) : content;
  if (normalized.length === 0) return [];
  return normalized.split('\n');
}

function computeEditDiffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.length > 0 ? oldText.split('\n') : [];
  const newLines = newText.length > 0 ? newText.split('\n') : [];
  const rowCount = oldLines.length + 1;
  const colCount = newLines.length + 1;
  const dp: number[][] = Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => 0));

  for (let row = 1; row <= oldLines.length; row += 1) {
    for (let col = 1; col <= newLines.length; col += 1) {
      if (oldLines[row - 1] === newLines[col - 1]) {
        dp[row]![col] = dp[row - 1]![col - 1]! + 1;
      } else {
        dp[row]![col] = Math.max(dp[row - 1]![col]!, dp[row]![col - 1]!);
      }
    }
  }

  const lines: DiffLine[] = [];
  let row = oldLines.length;
  let col = newLines.length;
  while (row > 0 || col > 0) {
    if (row > 0 && col > 0 && oldLines[row - 1] === newLines[col - 1]) {
      row -= 1;
      col -= 1;
    } else if (col > 0 && (row === 0 || dp[row]![col - 1]! >= dp[row - 1]![col]!)) {
      lines.push({ kind: 'add', text: newLines[col - 1]! });
      col -= 1;
    } else {
      lines.push({ kind: 'delete', text: oldLines[row - 1]! });
      row -= 1;
    }
  }
  return lines.toReversed();
}

function buildWriteDiffLines(args: Record<string, unknown>): DiffLine[] {
  return splitContentLines(strArg(args, 'content')).map((text) => ({ kind: 'add' as const, text }));
}

function buildEditDiffLines(args: Record<string, unknown>): DiffLine[] {
  const oldStr = strArg(args, 'old_string');
  const newStr = strArg(args, 'new_string');
  if (oldStr.length === 0 && newStr.length === 0) return [];
  return computeEditDiffLines(oldStr, newStr);
}

export function buildToolDiffLines(
  toolName: string | undefined,
  args: Record<string, unknown> | undefined,
): DiffLine[] | undefined {
  if (args === undefined) return undefined;
  if (toolName === 'Write') {
    const lines = buildWriteDiffLines(args);
    return lines.length > 0 ? lines : undefined;
  }
  if (toolName === 'Edit') {
    const lines = buildEditDiffLines(args);
    return lines.length > 0 ? lines : undefined;
  }
  return undefined;
}

export function computeToolChangeStats(
  toolName: string | undefined,
  args: Record<string, unknown> | undefined,
): ToolChangeStats | undefined {
  const lines = buildToolDiffLines(toolName, args);
  if (lines === undefined) return undefined;
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.kind === 'add') additions += 1;
    else deletions += 1;
  }
  return additions > 0 || deletions > 0 ? { additions, deletions } : undefined;
}
