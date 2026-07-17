import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  browserTabsRestoreKey,
  browserTabsToRestore,
  clampIndex,
  readGlobalUi,
  readProjectUi,
  readSessionUi,
  snapshotFromBrowserTabs,
  writeGlobalUi,
  writeProjectUi,
  writeSessionUi,
} from '../src/renderer/workspace-ui-persistence';
import {
  readProjectRuntime,
  readSessionRuntime,
  resetWorkspaceRuntimeUi,
  writeProjectRuntime,
  writeSessionRuntime,
} from '../src/renderer/workspace-runtime-ui';

function installLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
}

describe('workspace-ui-persistence', () => {
  beforeEach(() => {
    installLocalStorage();
    window.localStorage.clear();
  });

  it('reads and writes global UI defaults without sidebar panel state', () => {
    expect(readGlobalUi()).toMatchObject({
      sidebarOpen: true,
      route: 'new',
    });

    writeGlobalUi({
      sidebarOpen: false,
      route: 'settings',
      activeProjectWorkDir: '/workspace/example',
      activeSessionId: 'session-1',
    });

    expect(readGlobalUi()).toMatchObject({
      sidebarOpen: false,
      route: 'settings',
      activeProjectWorkDir: '/workspace/example',
      activeSessionId: 'session-1',
    });
  });

  it('merges project UI snapshots per workDir', () => {
    writeProjectUi('/workspace/example', {
      filesSelectedPath: '/workspace/example/src/app.tsx',
      selectedPlanPath: '/tmp/example-plan.md',
      review: { stagedTab: true, commitMessage: 'fix: example' },
    });

    const snapshot = readProjectUi('/workspace/example');
    expect(snapshot.filesSelectedPath).toBe('/workspace/example/src/app.tsx');
    expect(snapshot.selectedPlanPath).toBe('/tmp/example-plan.md');
    expect(snapshot.review.stagedTab).toBe(true);
    expect(snapshot.review.commitMessage).toBe('fix: example');
  });

  it('merges session UI snapshots per session id', () => {
    writeSessionUi('session-1', {
      agentsSelectedTaskId: 'task-9',
    });

    expect(readSessionUi('session-1')).toEqual({
      agentsSelectedTaskId: 'task-9',
    });
  });

  it('normalizes browser tab restore snapshots', () => {
    expect(browserTabsToRestore(undefined)).toEqual({
      urls: ['about:blank'],
      activeIndex: 0,
    });
    expect(
      browserTabsToRestore({ urls: ['https://example.test'], activeIndex: 4 }),
    ).toEqual({
      urls: ['https://example.test'],
      activeIndex: 0,
    });
  });

  it('builds browser tab snapshots from live tabs', () => {
    expect(
      snapshotFromBrowserTabs(
        [
          { id: 'a', url: 'https://example.test/a' },
          { id: 'b', url: 'https://example.test/b' },
        ],
        'b',
      ),
    ).toEqual({
      urls: ['https://example.test/a', 'https://example.test/b'],
      activeIndex: 1,
    });
  });

  it('serializes browser tab restore keys', () => {
    const snapshot = browserTabsToRestore({
      urls: ['https://example.test/a', 'https://example.test/b'],
      activeIndex: 1,
    });
    expect(browserTabsRestoreKey(snapshot)).toBe(
      'https://example.test/a\u0001https://example.test/b\u00021',
    );
  });

  it('clamps indexes safely', () => {
    expect(clampIndex(-2, 3)).toBe(0);
    expect(clampIndex(9, 3)).toBe(2);
    expect(clampIndex(Number.NaN, 3)).toBe(0);
  });
});

describe('workspace-runtime-ui', () => {
  beforeEach(() => {
    installLocalStorage();
    window.localStorage.clear();
    resetWorkspaceRuntimeUi();
  });

  it('keeps terminal and browser tab state in memory only', () => {
    writeProjectRuntime('/workspace/example', {
      terminalTabCount: 3,
      activeTerminalIndex: 1,
      browserTabs: { urls: ['https://example.test'], activeIndex: 0 },
      browserBookmarksOpen: false,
    });
    writeSessionRuntime('session-1', {
      browserTabs: { urls: ['https://example.test/a', 'https://example.test/b'], activeIndex: 1 },
      browserBookmarksOpen: false,
    });

    expect(readProjectRuntime('/workspace/example')).toMatchObject({
      terminalTabCount: 3,
      activeTerminalIndex: 1,
      browserTabs: { urls: ['https://example.test'], activeIndex: 0 },
      browserBookmarksOpen: false,
    });
    expect(readSessionRuntime('session-1')).toEqual({
      browserTabs: { urls: ['https://example.test/a', 'https://example.test/b'], activeIndex: 1 },
      browserBookmarksOpen: false,
    });
    expect(readProjectUi('/workspace/example')).not.toHaveProperty('terminalTabCount');
    expect(readSessionUi('session-1')).not.toHaveProperty('browserTabs');
  });
});
