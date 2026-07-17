import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  extractPlanTitle,
  listProjectPlans,
  readPlanFile,
} from '../src/main/plan-catalog';
import { isWorkspaceSpecPath } from '../src/shared/plan-paths';

async function createSessionWithPlan(options: {
  readonly root: string;
  readonly sessionId: string;
  readonly title?: string;
  readonly planFile: string;
  readonly content: string;
}): Promise<{ id: string; title?: string; sessionDir: string }> {
  const sessionDir = join(options.root, options.sessionId);
  const plansDir = join(sessionDir, 'agents', 'main', 'plans');
  await mkdir(plansDir, { recursive: true });
  await writeFile(join(plansDir, options.planFile), options.content, 'utf8');
  return {
    id: options.sessionId,
    title: options.title,
    sessionDir,
  };
}

describe('listProjectPlans', () => {
  it('scans session plan directories and prefers frontmatter name', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ganymede-plans-'));
    const session = await createSessionWithPlan({
      root,
      sessionId: 'sess-1',
      title: 'Feature work',
      planFile: 'alpha.md',
      content: `---
name: Alpha Plan
overview: Demo
---

# Ignored heading
`,
    });

    const plans = await listProjectPlans([session]);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      id: 'alpha',
      fileName: 'alpha.md',
      sessionId: 'sess-1',
      sessionTitle: 'Feature work',
      title: 'Alpha Plan',
      kind: 'implementation',
    });
    expect(plans[0]?.path).toContain(join('agents', 'main', 'plans', 'alpha.md'));
  });

  it('includes workspace design specs and sorts by mtime', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'ganymede-work-'));
    const sessionRoot = await mkdtemp(join(tmpdir(), 'ganymede-sessions-'));
    const session = await createSessionWithPlan({
      root: sessionRoot,
      sessionId: 'sess-impl',
      title: 'Impl session',
      planFile: 'impl.md',
      content: '---\nname: Impl Plan\n---\n\n# Body\n',
    });
    const specsDir = join(workDir, 'docs', 'kimicodeboost', 'specs');
    await mkdir(specsDir, { recursive: true });
    await writeFile(
      join(specsDir, '2026-07-17-snake-game-design.md'),
      '# Snake Game Design\n\nScope confirmed.\n',
      'utf8',
    );

    const plans = await listProjectPlans([session], workDir);
    expect(plans).toHaveLength(2);
    expect(plans.map((plan) => plan.kind).sort()).toEqual(['implementation', 'spec']);
    const spec = plans.find((plan) => plan.kind === 'spec');
    expect(spec).toMatchObject({
      fileName: '2026-07-17-snake-game-design.md',
      sessionId: 'workspace',
      sessionTitle: '设计规格',
      title: 'Snake Game Design',
      kind: 'spec',
    });
    const impl = plans.find((plan) => plan.kind === 'implementation');
    expect(impl).toMatchObject({
      fileName: 'impl.md',
      title: 'Impl Plan',
      kind: 'implementation',
    });
  });
});

describe('readPlanFile', () => {
  it('reads files inside known plan directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ganymede-plans-'));
    const session = await createSessionWithPlan({
      root,
      sessionId: 'sess-2',
      planFile: 'beta.md',
      content: '# Beta\n\nHello',
    });
    const path = join(session.sessionDir, 'agents', 'main', 'plans', 'beta.md');
    await expect(readPlanFile(path, [session])).resolves.toBe('# Beta\n\nHello');
  });

  it('reads workspace design specs when workDir is provided', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'ganymede-work-'));
    const specsDir = join(workDir, 'docs', 'kimicodeboost', 'specs');
    await mkdir(specsDir, { recursive: true });
    const path = join(specsDir, 'design.md');
    await writeFile(path, '# Spec\n\nBody', 'utf8');
    await expect(readPlanFile(path, [], workDir)).resolves.toBe('# Spec\n\nBody');
  });

  it('rejects paths outside session plan directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ganymede-plans-'));
    const session = await createSessionWithPlan({
      root,
      sessionId: 'sess-3',
      planFile: 'gamma.md',
      content: '# Gamma',
    });
    const outside = join(root, 'secret.md');
    await writeFile(outside, 'nope', 'utf8');
    await expect(readPlanFile(outside, [session])).rejects.toThrow(
      /outside known session plan directories/i,
    );
  });

  it('rejects workspace paths outside the specs directory', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'ganymede-work-'));
    const docsDir = join(workDir, 'docs');
    await mkdir(docsDir, { recursive: true });
    const outside = join(docsDir, 'notes.md');
    await writeFile(outside, 'nope', 'utf8');
    await expect(readPlanFile(outside, [], workDir)).rejects.toThrow(
      /outside known session plan directories/i,
    );
  });
});

describe('extractPlanTitle', () => {
  it('uses markdown heading when frontmatter name is absent', () => {
    expect(extractPlanTitle('# Title\n\nBody', 'fallback')).toBe('Title');
  });
});

describe('isWorkspaceSpecPath', () => {
  it('matches relative and absolute workspace spec paths', () => {
    expect(isWorkspaceSpecPath('docs/kimicodeboost/specs/foo-design.md')).toBe(true);
    expect(isWorkspaceSpecPath('docs/kimicodeboost/specs/nested/foo.md')).toBe(false);
    expect(isWorkspaceSpecPath('docs/other/foo.md')).toBe(false);
    expect(
      isWorkspaceSpecPath('/tmp/project/docs/kimicodeboost/specs/foo.md', '/tmp/project'),
    ).toBe(true);
  });
});
