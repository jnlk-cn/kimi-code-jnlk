export type TodoStatus = 'pending' | 'in_progress' | 'done';

export interface TodoItem {
  readonly title: string;
  readonly status: TodoStatus;
}

function isTodoStatus(value: unknown): value is TodoStatus {
  return value === 'pending' || value === 'in_progress' || value === 'done';
}

export function isTodoItemShape(value: unknown): value is TodoItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record['title'] === 'string' && isTodoStatus(record['status']);
}

export function sanitizeTodos(raw: unknown): TodoItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isTodoItemShape)
    .map((todo) => ({ title: todo.title, status: todo.status }));
}

/** Hide the bar when empty or every item is done (aligned with Kimi TUI hydrate). */
export function shouldHideTodoBar(todos: readonly TodoItem[]): boolean {
  if (todos.length === 0) return true;
  return todos.every((todo) => todo.status === 'done');
}
