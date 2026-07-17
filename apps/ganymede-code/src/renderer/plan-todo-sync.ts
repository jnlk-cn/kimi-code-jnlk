import {
  parsePlanDocument,
  type PlanDocumentTodo,
  type PlanTodoStatus,
} from '../shared/plan-document';
import type { TodoItem, TodoStatus } from '../shared/todo';

export function planStatusToComposer(status: PlanTodoStatus): TodoStatus {
  if (status === 'completed' || status === 'cancelled') return 'done';
  if (status === 'in_progress') return 'in_progress';
  return 'pending';
}

export function composerStatusToPlan(status: TodoStatus): PlanTodoStatus {
  if (status === 'done') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  return 'pending';
}

export function planTodosToComposerItems(todos: readonly PlanDocumentTodo[]): TodoItem[] {
  return todos.map((todo) => ({
    title: todo.content,
    status: planStatusToComposer(todo.status),
  }));
}

function slugId(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base.length > 0 ? base : `task-${String(index + 1)}`;
}

export function composerItemsToPlanTodos(
  items: readonly TodoItem[],
  existing: readonly PlanDocumentTodo[] = [],
): PlanDocumentTodo[] {
  const byContent = new Map(existing.map((todo) => [todo.content, todo]));
  const usedIds = new Set<string>();
  return items.map((item, index) => {
    const previous = byContent.get(item.title);
    let id = previous?.id ?? slugId(item.title, index);
    if (usedIds.has(id)) id = `${id}-${String(index + 1)}`;
    usedIds.add(id);
    return {
      id,
      content: item.title,
      status: composerStatusToPlan(item.status),
    };
  });
}

export function resolveActivePlanPath(input: {
  readonly planFilePath?: string | undefined;
  readonly approvedPlanPath?: string | undefined;
}): string | undefined {
  const live = input.planFilePath?.trim();
  if (live !== undefined && live.length > 0) return live;
  const approved = input.approvedPlanPath?.trim();
  if (approved !== undefined && approved.length > 0) return approved;
  return undefined;
}

export function resolveUnifiedTodos(input: {
  readonly activePlanPath?: string | undefined;
  readonly planContent?: string | undefined;
  readonly sessionTodos: readonly TodoItem[];
}): {
  readonly todos: readonly TodoItem[];
  readonly fromPlan: boolean;
  readonly planTodos: readonly PlanDocumentTodo[];
} {
  if (input.activePlanPath !== undefined && input.planContent !== undefined) {
    const planTodos = parsePlanDocument(input.planContent).todos;
    return {
      todos: planTodosToComposerItems(planTodos),
      fromPlan: true,
      planTodos,
    };
  }
  return {
    todos: input.sessionTodos,
    fromPlan: false,
    planTodos: [],
  };
}
