import {
  sanitizeTodos,
  shouldHideTodoBar,
  type TodoItem,
  type TodoStatus,
} from '../shared/todo';

export type { TodoItem, TodoStatus };
export { sanitizeTodos, shouldHideTodoBar };

export interface VisibleTodos {
  readonly rows: readonly TodoItem[];
  readonly hidden: number;
  readonly hiddenCounts: Record<TodoStatus, number>;
}

const MAX_VISIBLE = 5;

const STATUS_LABELS: readonly { status: TodoStatus; label: string }[] = [
  { status: 'done', label: '已完成' },
  { status: 'in_progress', label: '进行中' },
  { status: 'pending', label: '待办' },
];

/**
 * Pick which todos to render when the list exceeds {@link MAX_VISIBLE}.
 * Mirrors Kimi TUI `selectVisibleTodos`.
 */
export function selectVisibleTodos(todos: readonly TodoItem[]): VisibleTodos {
  if (todos.length <= MAX_VISIBLE) {
    return {
      rows: [...todos],
      hidden: 0,
      hiddenCounts: { done: 0, in_progress: 0, pending: 0 },
    };
  }

  const inProgress: number[] = [];
  const pending: number[] = [];
  const done: number[] = [];
  for (const [i, todo] of todos.entries()) {
    if (todo.status === 'in_progress') inProgress.push(i);
    else if (todo.status === 'pending') pending.push(i);
    else done.push(i);
  }

  const picked = new Set<number>();
  for (const i of inProgress.slice(0, MAX_VISIBLE)) picked.add(i);

  if (picked.size < MAX_VISIBLE) {
    const doneCandidates = done.toReversed();
    const pendingCandidates = pending;

    const remaining = MAX_VISIBLE - picked.size;
    let doneCount: number;
    let pendingCount: number;
    if (doneCandidates.length === 0) {
      doneCount = 0;
      pendingCount = Math.min(remaining, pendingCandidates.length);
    } else if (pendingCandidates.length === 0) {
      pendingCount = 0;
      doneCount = Math.min(remaining, doneCandidates.length);
    } else {
      doneCount = 1;
      pendingCount = Math.min(remaining - 1, pendingCandidates.length);
      if (pendingCount < remaining - 1) {
        doneCount = Math.min(doneCandidates.length, remaining - pendingCount);
      }
    }

    for (let i = 0; i < doneCount; i++) picked.add(doneCandidates[i] as number);
    for (let i = 0; i < pendingCount; i++) picked.add(pendingCandidates[i] as number);
  }

  const sortedIdx = [...picked].toSorted((a, b) => a - b);

  const hiddenCounts: Record<TodoStatus, number> = { done: 0, in_progress: 0, pending: 0 };
  for (const [i, todo] of todos.entries()) {
    if (!picked.has(i)) {
      hiddenCounts[todo.status] += 1;
    }
  }

  return {
    rows: sortedIdx.map((i) => todos[i] as TodoItem),
    hidden: todos.length - sortedIdx.length,
    hiddenCounts,
  };
}

export function formatHiddenCounts(counts: Record<TodoStatus, number>): string {
  return STATUS_LABELS.filter(({ status }) => counts[status] > 0)
    .map(({ status, label }) => `${String(counts[status])} ${label}`)
    .join(' · ');
}

export function todoProgressSummary(todos: readonly TodoItem[]): string {
  const done = todos.filter((todo) => todo.status === 'done').length;
  const inProgress = todos.filter((todo) => todo.status === 'in_progress').length;
  const parts = [`${String(done)}/${String(todos.length)}`];
  if (inProgress > 0) parts.push(`${String(inProgress)} 进行中`);
  return parts.join(' · ');
}

export function activeTodos(todos: readonly TodoItem[]): readonly TodoItem[] {
  return todos.filter((todo) => todo.status === 'in_progress');
}

export function formatActiveTodoLabel(todos: readonly TodoItem[]): string {
  const active = activeTodos(todos);
  if (active.length === 0) return '';
  if (active.length === 1) return active[0]?.title ?? '';
  const first = active[0]?.title ?? '';
  return `${first} 等 ${String(active.length)} 项`;
}

/**
 * Extract todos from a TodoList tool-call args payload (write / clear).
 * Query mode omits `todos` and returns undefined (no state change).
 */
export function todosFromTodoListArgs(args: unknown): TodoItem[] | undefined {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return undefined;
  const record = args as Record<string, unknown>;
  if (!('todos' in record)) return undefined;
  return sanitizeTodos(record['todos']);
}
