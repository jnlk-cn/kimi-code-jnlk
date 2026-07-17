import { describe, expect, it } from 'vitest';

import {
  createQueuedComposerItem,
  enqueueComposerItem,
  promoteQueuedComposerItem,
  queuedComposerSummary,
  removeQueuedComposerItem,
  shiftQueuedComposerItem,
  takeQueuedComposerItem,
} from '../src/renderer/composer-queue';

describe('composer-queue', () => {
  it('enqueues and shifts FIFO', () => {
    let queue = enqueueComposerItem([], { text: 'first', id: 'a' });
    queue = enqueueComposerItem(queue, { text: 'second', id: 'b' });
    expect(queue.map((item) => item.id)).toEqual(['a', 'b']);

    const shifted = shiftQueuedComposerItem(queue);
    expect(shifted.item?.id).toBe('a');
    expect(shifted.next.map((item) => item.id)).toEqual(['b']);
  });

  it('promotes an item to the front', () => {
    const queue = [
      createQueuedComposerItem({ text: 'a', id: 'a' }),
      createQueuedComposerItem({ text: 'b', id: 'b' }),
      createQueuedComposerItem({ text: 'c', id: 'c' }),
    ];
    expect(promoteQueuedComposerItem(queue, 'c').map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(promoteQueuedComposerItem(queue, 'a')).toBe(queue);
  });

  it('removes and takes by id', () => {
    const queue = [
      createQueuedComposerItem({ text: 'a', id: 'a' }),
      createQueuedComposerItem({ text: 'b', id: 'b' }),
    ];
    expect(removeQueuedComposerItem(queue, 'a').map((item) => item.id)).toEqual(['b']);
    const taken = takeQueuedComposerItem(queue, 'b');
    expect(taken.item?.text).toBe('b');
    expect(taken.next.map((item) => item.id)).toEqual(['a']);
  });

  it('summarizes text or attachment names', () => {
    expect(
      queuedComposerSummary(createQueuedComposerItem({ text: '  hello   world  ', id: '1' })),
    ).toBe('hello world');
    expect(
      queuedComposerSummary(
        createQueuedComposerItem({
          text: '',
          id: '2',
          attachments: [{ kind: 'file', name: 'notes.md', path: '/tmp/notes.md' }],
        }),
      ),
    ).toBe('notes.md');
  });
});
