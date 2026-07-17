import type { BrowserTabsSnapshot } from './workspace-ui-persistence';

export interface ProjectRuntimeUi {
  readonly terminalTabCount: number;
  readonly activeTerminalIndex: number;
  readonly browserTabs: BrowserTabsSnapshot;
  readonly browserBookmarksOpen: boolean;
}

export interface SessionRuntimeUi {
  readonly browserTabs: BrowserTabsSnapshot;
  readonly browserBookmarksOpen: boolean;
}

const DEFAULT_BROWSER_TABS: BrowserTabsSnapshot = {
  urls: ['about:blank'],
  activeIndex: 0,
};

const DEFAULT_PROJECT_RUNTIME: ProjectRuntimeUi = {
  terminalTabCount: 1,
  activeTerminalIndex: 0,
  browserTabs: DEFAULT_BROWSER_TABS,
  browserBookmarksOpen: true,
};

const DEFAULT_SESSION_RUNTIME: SessionRuntimeUi = {
  browserTabs: DEFAULT_BROWSER_TABS,
  browserBookmarksOpen: true,
};

const projectRuntime = new Map<string, ProjectRuntimeUi>();
const sessionRuntime = new Map<string, SessionRuntimeUi>();

export function readProjectRuntime(workDir: string): ProjectRuntimeUi {
  return projectRuntime.get(workDir) ?? DEFAULT_PROJECT_RUNTIME;
}

export function writeProjectRuntime(workDir: string, partial: Partial<ProjectRuntimeUi>): void {
  projectRuntime.set(workDir, { ...readProjectRuntime(workDir), ...partial });
}

export function readSessionRuntime(sessionId: string): SessionRuntimeUi {
  return sessionRuntime.get(sessionId) ?? DEFAULT_SESSION_RUNTIME;
}

export function writeSessionRuntime(sessionId: string, partial: Partial<SessionRuntimeUi>): void {
  sessionRuntime.set(sessionId, { ...readSessionRuntime(sessionId), ...partial });
}

export function resetWorkspaceRuntimeUi(): void {
  projectRuntime.clear();
  sessionRuntime.clear();
}
