import { describe, expect, it } from 'vitest';

import {
  STREAMING_TAIL_TARGET,
  splitStreamingText,
} from '../src/renderer/streaming-text-split';

describe('splitStreamingText', () => {
  it('returns the full content as committed when not streaming', () => {
    expect(splitStreamingText('hello world', false)).toEqual({
      committed: 'hello world',
      tail: '',
    });
  });

  it('returns empty parts for empty content', () => {
    expect(splitStreamingText('', true)).toEqual({ committed: '', tail: '' });
    expect(splitStreamingText('', false)).toEqual({ committed: '', tail: '' });
  });

  it('keeps short streaming content entirely in the tail', () => {
    const short = 'short reply';
    expect(splitStreamingText(short, true)).toEqual({ committed: '', tail: short });
  });

  it('prefers a newline split near the target tail length', () => {
    const committed = `${'a'.repeat(40)}\n${'b'.repeat(40)}\n`;
    const tail = `${'c'.repeat(STREAMING_TAIL_TARGET - 10)}\nmore`;
    const content = committed + tail;
    const parts = splitStreamingText(content, true);
    expect(parts.committed.endsWith('\n') || parts.committed.length === 0).toBe(true);
    expect(parts.committed + parts.tail).toBe(content);
    expect(parts.tail.length).toBeGreaterThan(0);
    expect(parts.tail.length).toBeLessThanOrEqual(STREAMING_TAIL_TARGET + 40);
  });

  it('does not split inside an open code fence', () => {
    const before = 'Intro paragraph.\n\n';
    const fence = '```ts\nconst x = 1;\nconst y = 2;\n';
    const content = before + fence + 'still streaming';
    const parts = splitStreamingText(content, true);
    expect(parts.committed + parts.tail).toBe(content);
    expect(parts.tail).toContain('```ts');
    expect(parts.committed.includes('```ts')).toBe(false);
    // Entire unfinished fence (including any leading blank line) stays in the tail.
    expect(parts.tail.indexOf('```ts')).toBeLessThan(parts.tail.indexOf('const x'));
  });

  it('may split after a closed code fence', () => {
    const before = 'Intro.\n\n';
    const fence = '```ts\nconst x = 1;\n```\n\n';
    const after = `${'paragraph '.repeat(20)}tail end`;
    const content = before + fence + after;
    const parts = splitStreamingText(content, true);
    expect(parts.committed + parts.tail).toBe(content);
    expect(parts.committed.includes('```ts')).toBe(true);
    expect(parts.committed.includes('```\n')).toBe(true);
  });
});
