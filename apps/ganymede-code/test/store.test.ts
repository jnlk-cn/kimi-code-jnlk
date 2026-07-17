import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppStore } from '../src/main/store';
import type { AppSettings } from '../src/shared/contracts';
import { DEFAULT_ACCENT_DARK, DEFAULT_ACCENT_LIGHT, resolveAccentColor, resolveThemeMode } from '../src/shared/theme-accent';

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
      accentDark: DEFAULT_ACCENT_DARK,
      accentLight: DEFAULT_ACCENT_LIGHT,
      codeFont: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "JetBrains Mono", monospace',
    });
    current.setSettings({ locale: 'en-US', accentDark: '#abcdef', accentLight: '#123456', terminalFontSize: 16 });
    expect(current.getSettings()).toMatchObject({
      locale: 'en-US',
      accentDark: '#abcdef',
      accentLight: '#123456',
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
      isGitRepository: false,
    });
    expect(current.listProjects()).toEqual([
      expect.objectContaining({
        workDir: '/tmp/example',
        name: 'Example',
        additionalDirs: ['/tmp/shared'],
      }),
    ]);
  });

  it('migrates legacy accent setting into dark and light accent colors', () => {
    const current = store!;
    current.setSettings({ accent: '#00aaff' } as Partial<AppSettings>);
    expect(current.getSettings()).toMatchObject({
      accentDark: '#00aaff',
      accentLight: '#00aaff',
    });
    current.setSettings({ accentDark: '#112233' });
    expect(current.getSettings()).toMatchObject({
      accentDark: '#112233',
      accentLight: '#00aaff',
    });
  });

  it('resolves accent colors by theme mode', () => {
    const settings = {
      theme: 'system' as const,
      accentDark: DEFAULT_ACCENT_DARK,
      accentLight: DEFAULT_ACCENT_LIGHT,
    };
    expect(resolveThemeMode(settings, false)).toBe('dark');
    expect(resolveThemeMode(settings, true)).toBe('light');
    expect(resolveAccentColor(settings, false)).toBe(DEFAULT_ACCENT_DARK);
    expect(resolveAccentColor(settings, true)).toBe(DEFAULT_ACCENT_LIGHT);
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
      isGitRepository: false,
    };
    current.upsertProject(project);
    current.setProjectPinned(project.workDir, true);
    expect(current.listProjects()[0]?.pinned).toBe(true);

    current.removeProject(project.workDir);
    expect(current.listProjects()).toEqual([]);
    expect(current.isProjectHidden(project.workDir)).toBe(true);
    expect(current.listHiddenProjects().map((item) => item.workDir)).toEqual([project.workDir]);

    current.unhideProject(project.workDir);
    current.upsertProject(project);
    expect(current.isProjectHidden(project.workDir)).toBe(false);
    expect(current.listHiddenProjects()).toEqual([]);
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

  it('supports inbox unread counting, mark-all, and delete', () => {
    const current = store!;
    const first = current.addInbox({
      title: 'Done',
      detail: 'ok',
      status: 'success',
    });
    const second = current.addInbox({
      title: 'Failed',
      detail: 'boom',
      status: 'failed',
    });
    expect(current.countUnreadInbox()).toBe(2);
    current.markInboxRead(first.id);
    expect(current.countUnreadInbox()).toBe(1);
    current.markAllInboxRead();
    expect(current.countUnreadInbox()).toBe(0);
    current.deleteInbox(second.id);
    expect(current.listInbox().map((item) => item.id)).toEqual([first.id]);
  });

  it('deletes registered sites', () => {
    const current = store!;
    const site = current.saveSite({
      title: 'Preview',
      path: '/tmp/site',
    });
    expect(current.listSites()).toHaveLength(1);
    current.deleteSite(site.id);
    expect(current.listSites()).toEqual([]);
  });

  it('persists task meta without approved plan path', () => {
    const current = store!;
    current.setTaskMeta('session-1', { target: 'local', unread: false });
    expect(current.taskMeta('session-1')).toMatchObject({
      pinned: false,
      unread: false,
      target: 'local',
      approvedPlanPath: undefined,
    });
    current.setTaskMeta('session-1', { approvedPlanPath: '/tmp/plan.md' });
    expect(current.taskMeta('session-1')).toMatchObject({
      approvedPlanPath: '/tmp/plan.md',
    });
    current.setTaskMeta('session-1', { approvedPlanPath: null });
    expect(current.taskMeta('session-1')).toMatchObject({
      approvedPlanPath: undefined,
    });
  });
});
