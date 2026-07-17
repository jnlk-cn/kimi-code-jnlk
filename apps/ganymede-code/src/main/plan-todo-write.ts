import { writeFile } from 'node:fs/promises';

import {
  parsePlanDocument,
  serializePlanDocument,
  type PlanDocumentTodo,
} from '../shared/plan-document';
import type { TodoItem } from '../shared/todo';
import { readPlanFile, type PlanSessionRef } from './plan-catalog';

function slugId(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base.length > 0 ? base : `task-${String(index + 1)}`;
}

export function sessionTodosToPlanTodos(items: readonly TodoItem[]): PlanDocumentTodo[] {
  return items.map((item, index) => ({
    id: slugId(item.title, index),
    content: item.title,
    status:
      item.status === 'done'
        ? 'completed'
        : item.status === 'in_progress'
          ? 'in_progress'
          : 'pending',
  }));
}

export async function patchPlanTodos(
  absolutePath: string,
  todos: readonly PlanDocumentTodo[],
  sessions: readonly PlanSessionRef[],
): Promise<string> {
  const content = await readPlanFile(absolutePath, sessions);
  const doc = parsePlanDocument(content);
  const next = serializePlanDocument({
    meta: doc.meta,
    todos,
    body: doc.body,
  });
  await writeFile(absolutePath, next, 'utf8');
  return next;
}

/**
 * When the plan has no todos yet but the session has a TodoList checklist,
 * merge those items into the plan frontmatter once.
 */
export async function mergeSessionTodosIntoPlanIfEmpty(
  absolutePath: string,
  sessionTodos: readonly TodoItem[],
  sessions: readonly PlanSessionRef[],
): Promise<string | undefined> {
  if (sessionTodos.length === 0) return undefined;
  const content = await readPlanFile(absolutePath, sessions);
  const doc = parsePlanDocument(content);
  if (doc.todos.length > 0) return undefined;
  return patchPlanTodos(absolutePath, sessionTodosToPlanTodos(sessionTodos), sessions);
}
