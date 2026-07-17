import { describe, expect, it } from 'vitest';

import {
  composerItemsToPlanTodos,
  planTodosToComposerItems,
  resolveActivePlanPath,
  resolveUnifiedTodos,
} from '../src/renderer/plan-todo-sync';

describe('plan-todo-sync', () => {
  it('maps plan statuses to composer statuses', () => {
    expect(
      planTodosToComposerItems([
        { id: 'a', content: 'One', status: 'pending' },
        { id: 'b', content: 'Two', status: 'in_progress' },
        { id: 'c', content: 'Three', status: 'completed' },
        { id: 'd', content: 'Four', status: 'cancelled' },
      ]),
    ).toEqual([
      { title: 'One', status: 'pending' },
      { title: 'Two', status: 'in_progress' },
      { title: 'Three', status: 'done' },
      { title: 'Four', status: 'done' },
    ]);
  });

  it('preserves existing plan todo ids when remapping composer items', () => {
    const next = composerItemsToPlanTodos(
      [
        { title: 'Wire panel', status: 'in_progress' },
        { title: 'Add tests', status: 'pending' },
      ],
      [{ id: 'wire', content: 'Wire panel', status: 'pending' }],
    );
    expect(next).toEqual([
      { id: 'wire', content: 'Wire panel', status: 'in_progress' },
      { id: 'add-tests', content: 'Add tests', status: 'pending' },
    ]);
  });

  it('prefers live planFilePath over approvedPlanPath', () => {
    expect(
      resolveActivePlanPath({
        planFilePath: '/tmp/live.md',
        approvedPlanPath: '/tmp/approved.md',
      }),
    ).toBe('/tmp/live.md');
    expect(resolveActivePlanPath({ approvedPlanPath: '/tmp/approved.md' })).toBe(
      '/tmp/approved.md',
    );
    expect(resolveActivePlanPath({})).toBeUndefined();
  });

  it('uses plan todos when an active plan path and content are present', () => {
    const content = `---
name: Demo
todos:
  - id: t1
    content: First
    status: pending
---

# Body
`;
    const unified = resolveUnifiedTodos({
      activePlanPath: '/tmp/plan.md',
      planContent: content,
      sessionTodos: [{ title: 'Session only', status: 'pending' }],
    });
    expect(unified.fromPlan).toBe(true);
    expect(unified.todos).toEqual([{ title: 'First', status: 'pending' }]);
  });

  it('falls back to session todos without a bound plan', () => {
    const unified = resolveUnifiedTodos({
      sessionTodos: [{ title: 'Session only', status: 'done' }],
    });
    expect(unified.fromPlan).toBe(false);
    expect(unified.todos).toEqual([{ title: 'Session only', status: 'done' }]);
  });
});
