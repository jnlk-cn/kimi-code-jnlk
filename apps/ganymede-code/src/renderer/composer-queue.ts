import type { PromptAttachment, PromptReference } from '../shared/contracts';

export interface QueuedComposerItem {
  readonly id: string;
  readonly text: string;
  readonly attachments: readonly PromptAttachment[];
  readonly references: readonly PromptReference[];
  readonly createdAt: number;
}

export interface QueuedComposerDraft {
  readonly text: string;
  readonly attachments?: readonly PromptAttachment[];
  readonly references?: readonly PromptReference[];
  readonly createdAt?: number;
  readonly id?: string;
}

export function createQueuedComposerItem(
  draft: QueuedComposerDraft,
  idFactory: () => string = () => `queued:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
): QueuedComposerItem {
  return {
    id: draft.id ?? idFactory(),
    text: draft.text,
    attachments: draft.attachments ?? [],
    references: draft.references ?? [],
    createdAt: draft.createdAt ?? Date.now(),
  };
}

export function enqueueComposerItem(
  queue: readonly QueuedComposerItem[],
  draft: QueuedComposerDraft,
  idFactory?: () => string,
): readonly QueuedComposerItem[] {
  return [...queue, createQueuedComposerItem(draft, idFactory)];
}

export function removeQueuedComposerItem(
  queue: readonly QueuedComposerItem[],
  id: string,
): readonly QueuedComposerItem[] {
  return queue.filter((item) => item.id !== id);
}

export function promoteQueuedComposerItem(
  queue: readonly QueuedComposerItem[],
  id: string,
): readonly QueuedComposerItem[] {
  const index = queue.findIndex((item) => item.id === id);
  if (index <= 0) return queue;
  const next = [...queue];
  const [item] = next.splice(index, 1);
  if (item === undefined) return queue;
  next.unshift(item);
  return next;
}

export function shiftQueuedComposerItem(
  queue: readonly QueuedComposerItem[],
): {
  readonly next: readonly QueuedComposerItem[];
  readonly item: QueuedComposerItem | undefined;
} {
  if (queue.length === 0) return { next: queue, item: undefined };
  const [item, ...rest] = queue;
  return { next: rest, item };
}

export function takeQueuedComposerItem(
  queue: readonly QueuedComposerItem[],
  id: string,
): {
  readonly next: readonly QueuedComposerItem[];
  readonly item: QueuedComposerItem | undefined;
} {
  const item = queue.find((entry) => entry.id === id);
  if (item === undefined) return { next: queue, item: undefined };
  return { next: removeQueuedComposerItem(queue, id), item };
}

export function queuedComposerSummary(item: QueuedComposerItem): string {
  const trimmed = item.text.replaceAll(/\s+/g, ' ').trim();
  if (trimmed.length > 0) return trimmed;
  const names = [
    ...item.attachments.map((attachment) => attachment.name),
    ...item.references.map((reference) => {
      switch (reference.kind) {
        case 'path':
          return reference.name;
        case 'skill':
          return `$${reference.name}`;
        case 'codebase':
          return `@codebase ${reference.query}`;
        case 'session':
          return reference.title;
      }
    }),
  ].filter((name) => name.length > 0);
  return names.length > 0 ? names.join(', ') : '(empty)';
}
