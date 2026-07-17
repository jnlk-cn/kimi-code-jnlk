import type { WorkspaceRoute } from './components/workspace-sidebar';

const PREFIX = 'ganymede';

const WORKSPACE_ROUTES: readonly WorkspaceRoute[] = [
  'new',
  'inbox',
  'scheduled',
  'plugins',
  'sites',
  'pulls',
  'git-sync',
  'chat',
  'memory',
  'settings',
];

export interface BrowserTabsSnapshot {
  readonly urls: readonly string[];
  readonly activeIndex: number;
}

export interface ReviewPanelSnapshot {
  readonly stagedTab: boolean;
  readonly selectedFile?: string;
  readonly commitMessage: string;
}

export interface ProjectUiSnapshot {
  readonly filesSelectedPath?: string;
  readonly selectedPlanPath?: string;
  readonly review: ReviewPanelSnapshot;
}

export interface SessionUiSnapshot {
  readonly agentsSelectedTaskId?: string;
}

export interface GlobalUiSnapshot {
  readonly sidebarOpen: boolean;
  readonly activeProjectWorkDir?: string;
  readonly activeSessionId?: string;
  readonly route: WorkspaceRoute;
  readonly sidebarNativeNavOpen: boolean;
  readonly sidebarExpandedProjects: readonly string[];
  readonly sidebarRevealedAllProjects: readonly string[];
}

const DEFAULT_REVIEW: ReviewPanelSnapshot = {
  stagedTab: false,
  commitMessage: '',
};

const DEFAULT_PROJECT_UI: ProjectUiSnapshot = {
  review: DEFAULT_REVIEW,
};

const DEFAULT_SESSION_UI: SessionUiSnapshot = {};

export function readGlobalUi(): GlobalUiSnapshot {
  return {
    sidebarOpen: storedBoolean(`${PREFIX}.sidebarOpen`, true),
    activeProjectWorkDir: readOptionalString(`${PREFIX}.activeProjectWorkDir`),
    activeSessionId: readOptionalString(`${PREFIX}.activeSessionId`),
    route: parseStartupRoute(window.localStorage.getItem(`${PREFIX}.route`)),
    sidebarNativeNavOpen: storedBoolean(`${PREFIX}.sidebarNativeNavOpen`, true),
    sidebarExpandedProjects: readStringArray(`${PREFIX}.sidebarExpandedProjects`),
    sidebarRevealedAllProjects: readStringArray(`${PREFIX}.sidebarRevealedAllProjects`),
  };
}

export function writeGlobalUi(partial: Partial<GlobalUiSnapshot>): void {
  if (partial.sidebarOpen !== undefined) {
    window.localStorage.setItem(`${PREFIX}.sidebarOpen`, String(partial.sidebarOpen));
  }
  if (partial.activeProjectWorkDir !== undefined) {
    if (partial.activeProjectWorkDir.length === 0) {
      window.localStorage.removeItem(`${PREFIX}.activeProjectWorkDir`);
    } else {
      window.localStorage.setItem(`${PREFIX}.activeProjectWorkDir`, partial.activeProjectWorkDir);
    }
  }
  if (partial.activeSessionId !== undefined) {
    if (partial.activeSessionId.length === 0) {
      window.localStorage.removeItem(`${PREFIX}.activeSessionId`);
    } else {
      window.localStorage.setItem(`${PREFIX}.activeSessionId`, partial.activeSessionId);
    }
  }
  if (partial.route !== undefined) {
    window.localStorage.setItem(`${PREFIX}.route`, partial.route);
  }
  if (partial.sidebarNativeNavOpen !== undefined) {
    window.localStorage.setItem(`${PREFIX}.sidebarNativeNavOpen`, String(partial.sidebarNativeNavOpen));
  }
  if (partial.sidebarExpandedProjects !== undefined) {
    writeStringArray(`${PREFIX}.sidebarExpandedProjects`, partial.sidebarExpandedProjects);
  }
  if (partial.sidebarRevealedAllProjects !== undefined) {
    writeStringArray(`${PREFIX}.sidebarRevealedAllProjects`, partial.sidebarRevealedAllProjects);
  }
}

export function readProjectUi(workDir: string): ProjectUiSnapshot {
  return parseProjectUi(window.localStorage.getItem(projectKey(workDir)));
}

export function writeProjectUi(workDir: string, partial: Partial<ProjectUiSnapshot>): void {
  const next = mergeProjectUi(readProjectUi(workDir), partial);
  window.localStorage.setItem(projectKey(workDir), JSON.stringify(next));
}

export function readSessionUi(sessionId: string): SessionUiSnapshot {
  return parseSessionUi(window.localStorage.getItem(sessionKey(sessionId)));
}

export function writeSessionUi(sessionId: string, partial: Partial<SessionUiSnapshot>): void {
  const next = mergeSessionUi(readSessionUi(sessionId), partial);
  window.localStorage.setItem(sessionKey(sessionId), JSON.stringify(next));
}

export function browserTabsToRestore(snapshot: BrowserTabsSnapshot | undefined): BrowserTabsSnapshot {
  const urls = (snapshot?.urls ?? [])
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
  if (urls.length === 0) return { urls: ['about:blank'], activeIndex: 0 };
  const activeIndex = clampIndex(snapshot?.activeIndex ?? 0, urls.length);
  return { urls, activeIndex };
}

export function browserTabsRestoreKey(snapshot: BrowserTabsSnapshot): string {
  return `${snapshot.urls.join('\u0001')}\u0002${String(snapshot.activeIndex)}`;
}

export function snapshotFromBrowserTabs(
  tabs: readonly { readonly id: string; readonly url: string }[],
  activeId: string | undefined,
): BrowserTabsSnapshot {
  if (tabs.length === 0) return { urls: ['about:blank'], activeIndex: 0 };
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeId));
  return {
    urls: tabs.map((tab) => tab.url),
    activeIndex: activeIndex < 0 ? 0 : activeIndex,
  };
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.trunc(index)), length - 1);
}

function projectKey(workDir: string): string {
  return `${PREFIX}.projectUi:${encodeURIComponent(workDir)}`;
}

function sessionKey(sessionId: string): string {
  return `${PREFIX}.sessionUi:${encodeURIComponent(sessionId)}`;
}

function mergeProjectUi(current: ProjectUiSnapshot, partial: Partial<ProjectUiSnapshot>): ProjectUiSnapshot {
  return {
    filesSelectedPath: partial.filesSelectedPath !== undefined
      ? partial.filesSelectedPath
      : current.filesSelectedPath,
    selectedPlanPath: partial.selectedPlanPath !== undefined
      ? partial.selectedPlanPath
      : current.selectedPlanPath,
    review: partial.review === undefined
      ? current.review
      : { ...current.review, ...partial.review },
  };
}

function mergeSessionUi(current: SessionUiSnapshot, partial: Partial<SessionUiSnapshot>): SessionUiSnapshot {
  return {
    agentsSelectedTaskId: partial.agentsSelectedTaskId !== undefined
      ? partial.agentsSelectedTaskId
      : current.agentsSelectedTaskId,
  };
}

function parseProjectUi(raw: string | null): ProjectUiSnapshot {
  if (raw === null) return DEFAULT_PROJECT_UI;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PROJECT_UI;
    const record = parsed as Record<string, unknown>;
    const reviewRaw = record['review'];
    const review = typeof reviewRaw === 'object' && reviewRaw !== null
      ? {
          stagedTab: (reviewRaw as Record<string, unknown>)['stagedTab'] === true,
          selectedFile: readOptionalStringFromRecord(reviewRaw as Record<string, unknown>, 'selectedFile'),
          commitMessage: typeof (reviewRaw as Record<string, unknown>)['commitMessage'] === 'string'
            ? String((reviewRaw as Record<string, unknown>)['commitMessage'])
            : '',
        }
      : DEFAULT_REVIEW;
    return {
      filesSelectedPath: readOptionalStringFromRecord(record, 'filesSelectedPath'),
      selectedPlanPath: readOptionalStringFromRecord(record, 'selectedPlanPath'),
      review,
    };
  } catch {
    return DEFAULT_PROJECT_UI;
  }
}

function parseSessionUi(raw: string | null): SessionUiSnapshot {
  if (raw === null) return DEFAULT_SESSION_UI;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SESSION_UI;
    const record = parsed as Record<string, unknown>;
    return {
      agentsSelectedTaskId: readOptionalStringFromRecord(record, 'agentsSelectedTaskId'),
    };
  } catch {
    return DEFAULT_SESSION_UI;
  }
}

function parseStartupRoute(value: string | null): WorkspaceRoute {
  if (value === 'settings' || value === 'chat' || value === 'new') {
    return value;
  }
  return 'new';
}

function storedBoolean(key: string, fallback: boolean): boolean {
  const value = window.localStorage.getItem(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function readOptionalString(key: string): string | undefined {
  const value = window.localStorage.getItem(key);
  return value === null || value.length === 0 ? undefined : value;
}

function readOptionalStringFromRecord(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readStringArray(key: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

function writeStringArray(key: string, values: readonly string[]): void {
  window.localStorage.setItem(key, JSON.stringify([...values]));
}
