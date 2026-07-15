import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppStore } from '../src/main/store';

describe('AppStore', () => {
  let directory = '';
  let store: AppStore | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ganymede-store-'));
    store = new AppStore(join(directory, 'test.sqlite'), join(directory, 'worktrees'));
  });

  afterEach(async () => {
    store?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('persists settings and project metadata', () => {
    const current = store!;
    expect(current.getSettings()).toMatchObject({
      terminalFontSize: 13,
      codeFont: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "JetBrains Mono", monospace',
    });
    current.setSettings({ locale: 'en-US', accent: '#abcdef', terminalFontSize: 16 });
    expect(current.getSettings()).toMatchObject({
      locale: 'en-US',
      accent: '#abcdef',
      theme: 'dark',
      terminalFontSize: 16,
    });
    current.upsertProject({
      workDir: '/tmp/example',
      name: 'Example',
      updatedAt: 1,
      sessionCount: 0,
      pinned: false,
      additionalDirs: ['/tmp/shared'],
    });
    expect(current.listProjects()).toEqual([
      expect.objectContaining({
        workDir: '/tmp/example',
        name: 'Example',
        additionalDirs: ['/tmp/shared'],
      }),
    ]);
  });

  it('persists logging settings', () => {
    const current = store!;
    expect(current.getSettings()).toMatchObject({
      logLevel: 'debug',
      logMirrorConsole: true,
      logIpcTrace: false,
    });
    current.setSettings({
      logLevel: 'warn',
      logMirrorConsole: false,
      logIpcTrace: true,
    });
    expect(current.getSettings()).toMatchObject({
      logLevel: 'warn',
      logMirrorConsole: false,
      logIpcTrace: true,
    });
  });

  it('persists project pinning and hides projects without deleting their metadata contract', () => {
    const current = store!;
    const project = {
      workDir: '/tmp/example',
      name: 'Example',
      updatedAt: 1,
      sessionCount: 0,
      pinned: false,
      additionalDirs: [],
    };
    current.upsertProject(project);
    current.setProjectPinned(project.workDir, true);
    expect(current.listProjects()[0]?.pinned).toBe(true);

    current.removeProject(project.workDir);
    expect(current.listProjects()).toEqual([]);
    expect(current.isProjectHidden(project.workDir)).toBe(true);

    current.unhideProject(project.workDir);
    current.upsertProject(project);
    expect(current.isProjectHidden(project.workDir)).toBe(false);
    expect(current.listProjects()).toHaveLength(1);
  });

  it('indexes memories with FTS search', () => {
    const current = store!;
    current.saveMemory({
      content: 'Prefer worktree isolation for risky refactors.',
      projectPath: '/tmp/example',
      tags: ['workflow'],
    });
    const matches = current.searchMemories('worktree', '/tmp/example');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.content).toContain('worktree');
  });
});
