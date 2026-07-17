import { describe, expect, it } from 'vitest';

import {
  buildSessionTurns,
  formatTurnTitle,
  latestCompletedTurnWithEdits,
  splitEditPath,
  visibleTurnFiles,
  type SessionTurn,
} from '../src/renderer/session-turns';
import type { TimelineEntry } from '../src/renderer/timeline';

function entry(
  partial: Pick<TimelineEntry, 'id' | 'kind'> & Partial<TimelineEntry>,
): TimelineEntry {
  return {
    content: '',
    ...partial,
  };
}

describe('buildSessionTurns', () => {
  it('splits turns on user messages and merges Write/Edit stats by path', () => {
    const turns = buildSessionTurns([
      entry({ id: 'u1', kind: 'user', content: 'fix the sidebar' }),
      entry({
        id: 'a1',
        kind: 'assistant',
        content: 'I will update the dual sidebar layout.',
      }),
      entry({
        id: 't1',
        kind: 'tool',
        title: 'Write',
        toolArgs: {
          path: 'apps/ganymede-code/src/a.tsx',
          content: 'line1\nline2\nline3\n',
        },
      }),
      entry({
        id: 't2',
        kind: 'tool',
        title: 'Edit',
        toolArgs: {
          path: 'apps/ganymede-code/src/a.tsx',
          old_string: 'line2\nline3',
          new_string: 'line2\nline4',
        },
      }),
      entry({ id: 'u2', kind: 'user', content: 'also polish CSS' }),
      entry({
        id: 't3',
        kind: 'tool',
        title: 'Edit',
        toolArgs: {
          path: 'styles.css',
          old_string: 'a',
          new_string: 'b',
        },
      }),
      entry({
        id: 'a2',
        kind: 'assistant',
        content: 'Done polishing CSS.',
      }),
    ]);

    expect(turns).toHaveLength(2);
    expect(turns[0]?.id).toBe('u1');
    expect(turns[0]?.fileEdits).toEqual([
      { path: 'apps/ganymede-code/src/a.tsx', additions: 4, deletions: 1 },
    ]);
    expect(turns[0]?.totalAdditions).toBe(4);
    expect(turns[0]?.totalDeletions).toBe(1);
    expect(turns[0]?.assistantSummary).toBe('I will update the dual sidebar layout.');

    expect(turns[1]?.id).toBe('u2');
    expect(turns[1]?.fileEdits).toEqual([
      { path: 'styles.css', additions: 1, deletions: 1 },
    ]);
    expect(turns[1]?.assistantSummary).toBe('Done polishing CSS.');
  });

  it('ignores streaming, errored, and non-edit tools', () => {
    const turns = buildSessionTurns([
      entry({ id: 'u1', kind: 'user', content: 'hello' }),
      entry({
        id: 't1',
        kind: 'tool',
        title: 'Write',
        streaming: true,
        toolArgs: { path: 'a.ts', content: 'x\n' },
      }),
      entry({
        id: 't2',
        kind: 'tool',
        title: 'Write',
        error: true,
        toolArgs: { path: 'b.ts', content: 'y\n' },
      }),
      entry({
        id: 't3',
        kind: 'tool',
        title: 'Read',
        toolArgs: { path: 'c.ts' },
      }),
      entry({ id: 'a1', kind: 'assistant', content: 'No files changed.' }),
    ]);

    expect(turns).toHaveLength(1);
    expect(turns[0]?.fileEdits).toEqual([]);
    expect(turns[0]?.totalAdditions).toBe(0);
  });

  it('ignores leading non-user entries before the first user message', () => {
    const turns = buildSessionTurns([
      entry({ id: 's1', kind: 'status', content: 'resumed' }),
      entry({ id: 'u1', kind: 'user', content: 'go' }),
      entry({ id: 'a1', kind: 'assistant', content: 'ok' }),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.id).toBe('u1');
  });

  it('truncates long assistant summaries', () => {
    const long = '字'.repeat(200);
    const turns = buildSessionTurns([
      entry({ id: 'u1', kind: 'user', content: 'hi' }),
      entry({ id: 'a1', kind: 'assistant', content: long }),
    ]);
    expect(turns[0]?.assistantSummary.length).toBeLessThanOrEqual(160);
    expect(turns[0]?.assistantSummary.endsWith('…')).toBe(true);
  });
});

describe('latestCompletedTurnWithEdits', () => {
  const turns: SessionTurn[] = [
    {
      id: 'u1',
      userMessage: 'one',
      assistantSummary: '',
      fileEdits: [{ path: 'a.ts', additions: 1, deletions: 0 }],
      totalAdditions: 1,
      totalDeletions: 0,
      startEntryId: 'u1',
    },
    {
      id: 'u2',
      userMessage: 'two',
      assistantSummary: '',
      fileEdits: [],
      totalAdditions: 0,
      totalDeletions: 0,
      startEntryId: 'u2',
    },
  ];

  it('returns undefined while running', () => {
    expect(latestCompletedTurnWithEdits(turns, true)).toBeUndefined();
  });

  it('returns the latest turn that has file edits', () => {
    expect(latestCompletedTurnWithEdits(turns, false)?.id).toBe('u1');
  });
});

describe('formatTurnTitle / visibleTurnFiles / splitEditPath', () => {
  it('formats and truncates titles', () => {
    expect(formatTurnTitle('  hello   world  ')).toBe('hello world');
    expect(formatTurnTitle('x'.repeat(60)).endsWith('…')).toBe(true);
    expect(formatTurnTitle('')).toBe('（空消息）');
  });

  it('limits visible files until expanded', () => {
    const edits = [
      { path: 'a', additions: 1, deletions: 0 },
      { path: 'b', additions: 1, deletions: 0 },
      { path: 'c', additions: 1, deletions: 0 },
      { path: 'd', additions: 1, deletions: 0 },
    ];
    expect(visibleTurnFiles(edits, false).visible).toHaveLength(3);
    expect(visibleTurnFiles(edits, false).hidden).toBe(1);
    expect(visibleTurnFiles(edits, true).hidden).toBe(0);
  });

  it('splits path into dir and name', () => {
    expect(splitEditPath('apps/foo/bar.ts')).toEqual({ dir: 'apps/foo', name: 'bar.ts' });
    expect(splitEditPath('README.md')).toEqual({ dir: '', name: 'README.md' });
  });
});
