import { describe, expect, it } from 'vitest';

import {
  formatActiveTodoLabel,
  formatHiddenCounts,
  sanitizeTodos,
  selectVisibleTodos,
  shouldHideTodoBar,
  todoProgressSummary,
  todosFromTodoListArgs,
} from '../src/renderer/todo-panel';

describe('sanitizeTodos', () => {
  it('filters invalid entries', () => {
    expect(
      sanitizeTodos([
        { title: 'a', status: 'pending' },
        { title: 'b', status: 'wip' },
        { title: 1, status: 'done' },
        null,
      ]),
    ).toEqual([{ title: 'a', status: 'pending' }]);
  });
});

describe('selectVisibleTodos', () => {
  it('returns all rows when under the cap', () => {
    const todos = [
      { title: 'a', status: 'pending' as const },
      { title: 'b', status: 'done' as const },
    ];
    expect(selectVisibleTodos(todos).rows).toEqual(todos);
    expect(selectVisibleTodos(todos).hidden).toBe(0);
  });

  it('keeps in_progress and mixes pending/done when truncated', () => {
    const todos = [
      { title: 'p1', status: 'pending' as const },
      { title: 'd1', status: 'done' as const },
      { title: 'p2', status: 'pending' as const },
      { title: 'ip', status: 'in_progress' as const },
      { title: 'p3', status: 'pending' as const },
      { title: 'd2', status: 'done' as const },
      { title: 'p4', status: 'pending' as const },
    ];
    const visible = selectVisibleTodos(todos);
    expect(visible.rows).toHaveLength(5);
    expect(visible.rows.some((todo) => todo.status === 'in_progress')).toBe(true);
    expect(visible.hidden).toBe(2);
  });
});

describe('shouldHideTodoBar', () => {
  it('hides empty or all-done lists', () => {
    expect(shouldHideTodoBar([])).toBe(true);
    expect(shouldHideTodoBar([{ title: 'a', status: 'done' }])).toBe(true);
    expect(shouldHideTodoBar([{ title: 'a', status: 'pending' }])).toBe(false);
  });
});

describe('todosFromTodoListArgs', () => {
  it('returns sanitized list for write/clear and undefined for query', () => {
    expect(todosFromTodoListArgs({ todos: [{ title: 'x', status: 'pending' }] })).toEqual([
      { title: 'x', status: 'pending' },
    ]);
    expect(todosFromTodoListArgs({ todos: [] })).toEqual([]);
    expect(todosFromTodoListArgs({})).toBeUndefined();
  });
});

describe('summaries', () => {
  it('formats progress and hidden counts', () => {
    expect(
      todoProgressSummary([
        { title: 'a', status: 'done' },
        { title: 'b', status: 'in_progress' },
        { title: 'c', status: 'pending' },
      ]),
    ).toBe('1/3 · 1 进行中');
    expect(formatHiddenCounts({ done: 1, in_progress: 0, pending: 2 })).toBe('1 已完成 · 2 待办');
    expect(
      formatActiveTodoLabel([
        { title: 'a', status: 'done' },
        { title: 'Wire panel', status: 'in_progress' },
        { title: 'c', status: 'pending' },
      ]),
    ).toBe('Wire panel');
    expect(
      formatActiveTodoLabel([
        { title: 'First', status: 'in_progress' },
        { title: 'Second', status: 'in_progress' },
      ]),
    ).toBe('First 等 2 项');
  });
});
