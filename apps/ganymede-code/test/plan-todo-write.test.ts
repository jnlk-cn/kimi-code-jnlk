import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';

import { parsePlanDocument } from '../src/shared/plan-document';
import {
  mergeSessionTodosIntoPlanIfEmpty,
  patchPlanTodos,
  sessionTodosToPlanTodos,
} from '../src/main/plan-todo-write';

describe('plan-todo-write', () => {
  let root: string;

  afterEach(async () => {
    if (root !== undefined) await rm(root, { recursive: true, force: true });
  });

  async function setupPlan(content: string): Promise<{
    path: string;
    sessions: readonly { id: string; sessionDir: string }[];
  }> {
    root = await mkdtemp(join(tmpdir(), 'ganymede-plan-todo-'));
    const sessionDir = join(root, 'session');
    const plansDir = join(sessionDir, 'agents', 'main', 'plans');
    await mkdir(plansDir, { recursive: true });
    const path = join(plansDir, 'demo.md');
    await writeFile(path, content, 'utf8');
    return { path, sessions: [{ id: 's1', sessionDir }] };
  }

  it('patches todos while preserving meta and body', async () => {
    const { path, sessions } = await setupPlan(`---
name: Demo Plan
overview: Keep this
todos:
  - id: old
    content: Old task
    status: pending
---

# Body stays

Paragraph.
`);
    const next = await patchPlanTodos(
      path,
      [
        { id: 'old', content: 'Old task', status: 'completed' },
        { id: 'new', content: 'New task', status: 'pending' },
      ],
      sessions,
    );
    const doc = parsePlanDocument(next);
    expect(doc.meta).toEqual({ name: 'Demo Plan', overview: 'Keep this' });
    expect(doc.todos).toEqual([
      { id: 'old', content: 'Old task', status: 'completed' },
      { id: 'new', content: 'New task', status: 'pending' },
    ]);
    expect(doc.body).toContain('# Body stays');
    expect(await readFile(path, 'utf8')).toBe(next);
  });

  it('merges session todos only when plan todos are empty', async () => {
    const { path, sessions } = await setupPlan(`---
name: Empty Todos
todos: []
---

# Body
`);
    const merged = await mergeSessionTodosIntoPlanIfEmpty(
      path,
      [{ title: 'From session', status: 'pending' }],
      sessions,
    );
    expect(merged).toBeDefined();
    expect(parsePlanDocument(merged!).todos).toEqual([
      { id: 'from-session', content: 'From session', status: 'pending' },
    ]);

    const skipped = await mergeSessionTodosIntoPlanIfEmpty(
      path,
      [{ title: 'Ignored', status: 'done' }],
      sessions,
    );
    expect(skipped).toBeUndefined();
  });

  it('maps session todo statuses into plan statuses', () => {
    expect(
      sessionTodosToPlanTodos([
        { title: 'A', status: 'pending' },
        { title: 'B', status: 'in_progress' },
        { title: 'C', status: 'done' },
      ]),
    ).toEqual([
      { id: 'a', content: 'A', status: 'pending' },
      { id: 'b', content: 'B', status: 'in_progress' },
      { id: 'c', content: 'C', status: 'completed' },
    ]);
  });
});
