import { describe, expect, it } from 'vitest';

import type { GitFileStatus } from '../src/shared/contracts';
import {
  filterFilesByStage,
  gitFileStatusLabel,
  hasStagedChanges,
  isStagedFile,
  isUnstagedFile,
  isUntrackedFile,
  parseUnifiedDiffLines,
} from '../src/renderer/git-review';
import { formatLineStats, formatSyncState } from '../src/renderer/git-sync-display';

function file(partial: Partial<GitFileStatus> & Pick<GitFileStatus, 'path' | 'index' | 'worktree'>): GitFileStatus {
  return partial;
}

describe('filterFilesByStage', () => {
  const files: readonly GitFileStatus[] = [
    file({ path: 'a.ts', index: '?', worktree: '?' }),
    file({ path: 'b.ts', index: 'M', worktree: ' ' }),
    file({ path: 'c.ts', index: ' ', worktree: 'M' }),
    file({ path: 'd.ts', index: 'A', worktree: 'M' }),
  ];

  it('keeps untracked and worktree changes on the unstaged tab', () => {
    expect(filterFilesByStage(files, false).map((item) => item.path)).toEqual(['a.ts', 'c.ts', 'd.ts']);
  });

  it('keeps index changes on the staged tab', () => {
    expect(filterFilesByStage(files, true).map((item) => item.path)).toEqual(['b.ts', 'd.ts']);
  });
});

describe('git file status helpers', () => {
  it('detects untracked files', () => {
    expect(isUntrackedFile(file({ path: 'x', index: '?', worktree: '?' }))).toBe(true);
    expect(isUntrackedFile(file({ path: 'x', index: ' ', worktree: 'M' }))).toBe(false);
  });

  it('labels common status codes in Chinese', () => {
    expect(gitFileStatusLabel(file({ path: 'x', index: '?', worktree: '?' }))).toBe('未跟踪');
    expect(gitFileStatusLabel(file({ path: 'x', index: 'M', worktree: ' ' }))).toBe('修改');
    expect(gitFileStatusLabel(file({ path: 'x', index: 'A', worktree: ' ' }))).toBe('新增');
    expect(gitFileStatusLabel(file({ path: 'x', index: ' ', worktree: 'D' }))).toBe('删除');
    expect(gitFileStatusLabel(file({ path: 'x', index: 'R', worktree: ' ' }))).toBe('重命名');
  });

  it('reports staged presence', () => {
    expect(hasStagedChanges([file({ path: 'a', index: '?', worktree: '?' })])).toBe(false);
    expect(hasStagedChanges([file({ path: 'a', index: 'M', worktree: ' ' })])).toBe(true);
    expect(isStagedFile(file({ path: 'a', index: 'M', worktree: ' ' }))).toBe(true);
    expect(isUnstagedFile(file({ path: 'a', index: ' ', worktree: 'M' }))).toBe(true);
  });
});

describe('parseUnifiedDiffLines', () => {
  it('parses add, delete, context, header, and meta lines', () => {
    const text = [
      'diff --git a/foo.ts b/foo.ts',
      '--- a/foo.ts',
      '+++ b/foo.ts',
      '@@ -1,2 +1,3 @@',
      ' keep',
      '-old',
      '+new',
      '+extra',
    ].join('\n');
    expect(parseUnifiedDiffLines(text)).toEqual([
      { kind: 'meta', text: 'diff --git a/foo.ts b/foo.ts' },
      { kind: 'meta', text: '--- a/foo.ts' },
      { kind: 'meta', text: '+++ b/foo.ts' },
      { kind: 'header', text: '@@ -1,2 +1,3 @@' },
      { kind: 'context', text: 'keep' },
      { kind: 'delete', text: 'old' },
      { kind: 'add', text: 'new' },
      { kind: 'add', text: 'extra' },
    ]);
  });

  it('returns empty for empty input', () => {
    expect(parseUnifiedDiffLines('')).toEqual([]);
  });
});

describe('git sync display helpers', () => {
  it('formats line stats', () => {
    expect(formatLineStats({ additions: 12, deletions: 3 })).toBe('+12 / −3');
    expect(formatLineStats(undefined)).toBe('+0 / −0');
  });

  it('formats sync state copy', () => {
    expect(formatSyncState({ ahead: 0, behind: 0 })).toBe('未设置上游分支');
    expect(formatSyncState({ ahead: 0, behind: 0, upstream: 'origin/main' })).toBe('已与远程同步');
    expect(formatSyncState({ ahead: 2, behind: 0, upstream: 'origin/main' })).toBe('领先 2 个提交');
    expect(formatSyncState({ ahead: 0, behind: 3, upstream: 'origin/main' })).toBe('落后 3 个提交');
    expect(formatSyncState({ ahead: 1, behind: 2, upstream: 'origin/main' })).toBe('领先 1 · 落后 2');
  });
});
