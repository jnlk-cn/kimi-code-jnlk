import type { GitFileStatus } from '../shared/contracts';

export type UnifiedDiffLineKind = 'add' | 'delete' | 'context' | 'header' | 'meta';

export interface UnifiedDiffLine {
  readonly kind: UnifiedDiffLineKind;
  readonly text: string;
}

/** Files with worktree or untracked changes belong on the unstaged tab. */
export function isUnstagedFile(file: GitFileStatus): boolean {
  if (file.index === '?' && file.worktree === '?') return true;
  return file.worktree !== ' ' && file.worktree !== '?';
}

/** Files with index (staged) changes belong on the staged tab. */
export function isStagedFile(file: GitFileStatus): boolean {
  if (file.index === '?' && file.worktree === '?') return false;
  return file.index !== ' ' && file.index !== '?';
}

export function filterFilesByStage(
  files: readonly GitFileStatus[],
  staged: boolean,
): readonly GitFileStatus[] {
  return files.filter((file) => (staged ? isStagedFile(file) : isUnstagedFile(file)));
}

export function isUntrackedFile(file: GitFileStatus): boolean {
  return file.index === '?' && file.worktree === '?';
}

export function gitFileStatusLabel(file: GitFileStatus): string {
  if (isUntrackedFile(file)) return '未跟踪';
  const code = file.index !== ' ' && file.index !== '?' ? file.index : file.worktree;
  switch (code) {
    case 'A':
      return '新增';
    case 'M':
      return '修改';
    case 'D':
      return '删除';
    case 'R':
      return '重命名';
    case 'C':
      return '复制';
    case 'U':
      return '冲突';
    case 'T':
      return '类型变更';
    default:
      return code.trim().length > 0 ? code : '改动';
  }
}

export function parseUnifiedDiffLines(text: string): UnifiedDiffLine[] {
  if (text.length === 0) return [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  // Drop a trailing empty segment from a final newline so CodeMirror line count matches.
  if (lines.length > 0 && lines.at(-1) === '') lines.pop();
  return lines.map((line) => {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) {
      return { kind: 'meta' as const, text: line };
    }
    if (line.startsWith('@@')) {
      return { kind: 'header' as const, text: line };
    }
    if (line.startsWith('+')) {
      return { kind: 'add' as const, text: line.slice(1) };
    }
    if (line.startsWith('-')) {
      return { kind: 'delete' as const, text: line.slice(1) };
    }
    if (line.startsWith(' ')) {
      return { kind: 'context' as const, text: line.slice(1) };
    }
    return { kind: 'meta' as const, text: line };
  });
}

export function hasStagedChanges(files: readonly GitFileStatus[]): boolean {
  return files.some(isStagedFile);
}
