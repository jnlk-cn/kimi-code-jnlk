import {
  IPC,
  type ApprovalResolution,
  type Automation,
  type BrowserAction,
  type CreateSessionRequest,
  type DesktopApi,
  type DebugVerificationResolution,
  type EventEnvelope,
  type PendingApproval,
  type PendingDebugVerification,
  type PendingQuestion,
  type PromptRequest,
  type QuestionResolution,
  type SessionConfiguration,
  type SiteRecord,
  type TerminalDataEvent,
  type BrowserTab,
  type AppSettings,
  type MemoryRecord,
} from '../../shared/contracts';

type EventListener = (payload: unknown) => void;

interface InvokeResponse {
  readonly result?: unknown;
  readonly error?: string;
}

interface HealthResponse {
  readonly ok?: boolean;
  readonly ready?: boolean;
}

interface SseEnvelope {
  readonly channel: string;
  readonly payload: unknown;
}

const BRIDGE_POLL_MS = 100;
const BRIDGE_TIMEOUT_MS = 60_000;
const INVOKE_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createWebDesktopApi(): DesktopApi {
  const listeners = new Map<string, Set<EventListener>>();
  let source: EventSource | undefined;
  let bridgeReady: Promise<void> | undefined;

  async function waitForBridge(): Promise<void> {
    if (bridgeReady !== undefined) return bridgeReady;
    bridgeReady = (async () => {
      const deadline = Date.now() + BRIDGE_TIMEOUT_MS;
      while (Date.now() < deadline) {
        try {
          const response = await fetch('/api/health');
          if (response.ok) {
            const data = (await response.json()) as HealthResponse;
            if (data.ready === true) return;
          }
        } catch {
          // API not listening yet (proxy ECONNREFUSED) — keep polling.
        }
        await sleep(BRIDGE_POLL_MS);
      }
      throw new Error('Timed out waiting for Ganymede web bridge to become ready.');
    })();
    try {
      await bridgeReady;
    } catch (error: unknown) {
      bridgeReady = undefined;
      throw error;
    }
  }

  function ensureEvents(): void {
    if (source !== undefined) return;
    void waitForBridge()
      .then(() => {
        if (source !== undefined) return;
        source = new EventSource('/api/events');
        source.onmessage = (event) => {
          try {
            const envelope = JSON.parse(String(event.data)) as SseEnvelope;
            const channelListeners = listeners.get(envelope.channel);
            if (channelListeners === undefined) return;
            for (const listener of channelListeners) listener(envelope.payload);
          } catch (error: unknown) {
            console.error('[ganymede-web] failed to parse SSE event', error);
          }
        };
        source.onerror = () => {
          // Browser will reconnect EventSource automatically.
        };
      })
      .catch((error: unknown) => {
        console.error('[ganymede-web] failed to connect SSE', error);
      });
  }

  function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
    ensureEvents();
    let set = listeners.get(channel);
    if (set === undefined) {
      set = new Set();
      listeners.set(channel, set);
    }
    const wrapped: EventListener = (payload) => listener(payload as T);
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
      if (set !== undefined && set.size === 0) listeners.delete(channel);
    };
  }

  async function invokeOnce<T>(channel: string, input?: unknown): Promise<T> {
    const response = await fetch('/api/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, input }),
    });
    if (response.status === 502 || response.status === 503) {
      throw new Error(`Web bridge temporarily unavailable (${response.status}).`);
    }
    let data: InvokeResponse;
    try {
      data = (await response.json()) as InvokeResponse;
    } catch {
      throw new Error(`Web bridge returned non-JSON for ${channel} (${response.status}).`);
    }
    if (!response.ok || data.error !== undefined) {
      throw new Error(data.error ?? `Web bridge invoke failed for ${channel} (${response.status}).`);
    }
    return data.result as T;
  }

  async function invoke<T>(channel: string, input?: unknown): Promise<T> {
    await waitForBridge();
    let lastError: unknown;
    for (let attempt = 0; attempt < INVOKE_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await invokeOnce<T>(channel, input);
      } catch (error: unknown) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const retryable =
          message.includes('temporarily unavailable') ||
          message.includes('Failed to fetch') ||
          message.includes('NetworkError') ||
          message.includes('Load failed');
        if (!retryable || attempt === INVOKE_MAX_ATTEMPTS - 1) throw error;
        await sleep(BRIDGE_POLL_MS * 2 ** attempt);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Web bridge invoke failed for ${channel}.`);
  }

  const api: DesktopApi = {
    bootstrap: () => invoke(IPC.bootstrap),
    openExternal: async (url) => {
      globalThis.open?.(url, '_blank', 'noopener,noreferrer');
    },
    setAlwaysOnTop: async () => {
      // No-op in browser; window stacking is controlled by the host.
    },
    notify: (title, body) => invoke(IPC.notify, { title, body }),
    listProjects: () => invoke(IPC.projectsList),
    listHiddenProjects: () => invoke(IPC.projectsListHidden),
    openProject: () => invoke(IPC.projectOpen),
    removeProject: (workDir) => invoke(IPC.projectRemove, workDir),
    restoreProject: (workDir) => invoke(IPC.projectRestore, workDir),
    setProjectPinned: (workDir, pinned) => invoke(IPC.projectPin, { workDir, pinned }),
    inspectProject: (workDir) => invoke(IPC.projectInspect, workDir),
    addProjectDirectory: (workDir, sessionId) =>
      invoke(IPC.projectAdditionalDir, { workDir, sessionId }),
    pickAttachments: () => invoke(IPC.attachmentsPick),
    listSessions: (workDir, includeArchived) =>
      invoke(IPC.sessionsList, { workDir, includeArchived }),
    createSession: (input: CreateSessionRequest) => invoke(IPC.sessionCreate, input),
    resumeSession: (sessionId) => invoke(IPC.sessionResume, sessionId),
    sessionSnapshot: (sessionId) => invoke(IPC.sessionSnapshot, sessionId),
    prompt: (input: PromptRequest) => invoke(IPC.sessionPrompt, input),
    steer: (input: PromptRequest) => invoke(IPC.sessionSteer, input),
    cancelSession: (sessionId) => invoke(IPC.sessionCancel, sessionId),
    archiveSession: (sessionId) => invoke(IPC.sessionArchive, sessionId),
    pinSession: (id, pinned) => invoke(IPC.sessionPin, { id, pinned }),
    renameSession: (id, title) => invoke(IPC.sessionRename, { id, title }),
    forkSession: (id, workDir) => invoke(IPC.sessionFork, { id, workDir }),
    configureSession: (id, config: SessionConfiguration) =>
      invoke(IPC.sessionConfigure, { id, config }),
    compactSession: (sessionId, instruction) =>
      invoke(IPC.sessionCompact, { id: sessionId, instruction }),
    initSession: (sessionId) => invoke(IPC.sessionInit, sessionId),
    getSessionUsage: (sessionId) => invoke(IPC.sessionUsage, sessionId),
    clearSessionPlan: (sessionId) => invoke(IPC.sessionClearPlan, sessionId),
    closeSession: (sessionId) => invoke(IPC.sessionClose, sessionId),
    listProjectPlans: (workDir) => invoke(IPC.plansList, workDir),
    readPlanFile: (input) => invoke(IPC.planRead, input),
    patchPlanTodos: (input) => invoke(IPC.planPatchTodos, input),
    resolveApproval: (input: ApprovalResolution) => invoke(IPC.approvalResolve, input),
    resolveQuestion: (input: QuestionResolution) => invoke(IPC.questionResolve, input),
    resolveDebugVerification: (input: DebugVerificationResolution) =>
      invoke(IPC.debugVerificationResolve, input),
    authStatus: () => invoke(IPC.authStatus),
    authLogin: () => invoke(IPC.authLogin),
    authLogout: () => invoke(IPC.authLogout),
    modelConfiguration: () => invoke(IPC.modelsGet),
    configureDefaultModel: (input) => invoke(IPC.modelsConfigureDefault, input),
    listModelCatalog: () => invoke(IPC.modelsCatalogList),
    addCatalogProvider: (input) => invoke(IPC.modelsCatalogAdd, input),
    deepSeekBillingSnapshot: (input) => invoke(IPC.billingDeepSeekSnapshot, input ?? {}),
    contextUsageSnapshot: (input) => invoke(IPC.contextUsageSnapshot, input),
    gitStatus: (workDir) => invoke(IPC.gitStatus, workDir),
    gitInit: (workDir) => invoke(IPC.gitInit, workDir),
    gitDiff: (cwd, staged, file) => invoke(IPC.gitDiff, { cwd, staged, file }),
    gitStage: (cwd, paths) => invoke(IPC.gitStage, { cwd, paths }),
    gitUnstage: (cwd, paths) => invoke(IPC.gitUnstage, { cwd, paths }),
    gitRevert: (cwd, paths) => invoke(IPC.gitRevert, { cwd, paths }),
    gitCommit: (cwd, message) => invoke(IPC.gitCommit, { cwd, message }),
    gitPush: (workDir) => invoke(IPC.gitPush, workDir),
    gitFetch: (workDir) => invoke(IPC.gitFetch, workDir),
    gitPull: (workDir) => invoke(IPC.gitPull, workDir),
    gitCheckout: (cwd, branch) => invoke(IPC.gitCheckout, { cwd, branch }),
    gitCreateBranch: (cwd, name) => invoke(IPC.gitCreateBranch, { cwd, name }),
    gitBranches: (workDir) => invoke(IPC.gitBranches, workDir),
    pullRequests: (workDir, state) => invoke(IPC.gitPullRequests, { workDir, state }),
    pullRequestDetail: (cwd, number) => invoke(IPC.gitPullRequestDetail, { cwd, number }),
    createPullRequest: (cwd, title, body) =>
      invoke(IPC.gitPullRequestCreate, { cwd, title, body }),
    worktrees: (workDir) => invoke(IPC.gitWorktrees, workDir),
    createWorktree: (cwd, branch, includeChanges) =>
      invoke(IPC.worktreeCreate, { cwd, branch, includeChanges }),
    removeWorktree: (cwd, path) => invoke(IPC.worktreeRemove, { cwd, path }),
    handoffWorktree: (source, target) => invoke(IPC.worktreeHandoff, { source, target }),
    listFiles: (root) => invoke(IPC.filesList, root),
    searchWorkspacePaths: (root, query) => invoke(IPC.filesSearch, { root, query }),
    readFile: (root, path) => invoke(IPC.fileRead, { root, path }),
    writeFile: (root, path, content) => invoke(IPC.fileWrite, { root, path, content }),
    revealFile: (path) => invoke(IPC.fileReveal, path),
    openFileExternal: (path) => invoke(IPC.fileOpenExternal, path),
    previewWorkspaceFile: (root, path) => invoke(IPC.filePreview, { root, path }),
    openInEditor: (path, command) => invoke(IPC.fileOpenInEditor, { path, command }),
    openInTerminal: (path) => invoke(IPC.fileOpenInTerminal, path),
    listAvailableEditors: () => invoke(IPC.editorsList),
    createTerminal: (cwd, sessionId) => invoke(IPC.terminalCreate, { cwd, sessionId }),
    terminalInput: (id, data) => invoke(IPC.terminalInput, { id, data }),
    terminalResize: (id, cols, rows) => invoke(IPC.terminalResize, { id, cols, rows }),
    closeTerminal: (id) => invoke(IPC.terminalClose, id),
    createBrowser: (sessionId, url) => invoke(IPC.browserCreate, { sessionId, url }),
    browserNavigate: (id, url) => invoke(IPC.browserNavigate, { id, url }),
    browserAction: (id, action: BrowserAction) => invoke(IPC.browserAction, { id, action }),
    browserBounds: (id, bounds) => invoke(IPC.browserBounds, { id, bounds }),
    hideBrowser: (id) => invoke(IPC.browserHide, id),
    closeBrowser: (id) => invoke(IPC.browserClose, id),
    browserScreenshot: (id) => invoke(IPC.browserScreenshot, id),
    browserAnnotate: (id) => invoke(IPC.browserAnnotate, id),
    listPlugins: (sessionId) => invoke(IPC.pluginsList, { sessionId }),
    installPlugin: (source, sessionId) => invoke(IPC.pluginInstall, { source, sessionId }),
    enablePlugin: (id, enabled, sessionId) =>
      invoke(IPC.pluginEnable, { id, enabled, sessionId }),
    enablePluginMcp: (id, server, enabled, sessionId) =>
      invoke(IPC.pluginMcpEnable, { id, server, enabled, sessionId }),
    removePlugin: (id, sessionId) => invoke(IPC.pluginRemove, { id, sessionId }),
    listPluginCommands: (sessionId) => invoke(IPC.pluginCommandsList, { sessionId }),
    activatePluginCommand: (sessionId, pluginId, commandName, args, workDir) =>
      invoke(IPC.pluginCommandActivate, { sessionId, pluginId, commandName, args, workDir }),
    listSkills: (sessionId, workDir) => invoke(IPC.skillsList, { sessionId, workDir }),
    activateSkill: (sessionId, name, args, workDir) =>
      invoke(IPC.skillActivate, { sessionId, name, args, workDir }),
    listMcp: (sessionId) => invoke(IPC.mcpList, { sessionId }),
    reconnectMcp: (id, name) => invoke(IPC.mcpReconnect, { id, name }),
    listPluginMarketplace: (sessionId, workDir) =>
      invoke(IPC.pluginsMarketplace, { sessionId, workDir }),
    listBackgroundTasks: (sessionId) => invoke(IPC.backgroundTasksList, sessionId),
    getBackgroundTaskOutput: (sessionId, taskId, tail) =>
      invoke(IPC.backgroundTaskOutput, { sessionId, taskId, tail }),
    stopBackgroundTask: (sessionId, taskId) =>
      invoke(IPC.backgroundTaskStop, { sessionId, taskId }),
    listAutomations: () => invoke(IPC.automationsList),
    saveAutomation: (input) =>
      invoke(IPC.automationSave, input as Omit<Automation, 'id' | 'createdAt'> & { id?: string }),
    deleteAutomation: (id) => invoke(IPC.automationDelete, id),
    runAutomation: (id) => invoke(IPC.automationRun, id),
    listInbox: () => invoke(IPC.inboxList),
    markInboxRead: (id) => invoke(IPC.inboxRead, id),
    deleteInbox: (id) => invoke(IPC.inboxDelete, id),
    markAllInboxRead: () => invoke(IPC.inboxMarkAllRead),
    inboxUnreadCount: () => invoke(IPC.inboxUnreadCount),
    searchMemories: (query, projectPath) =>
      invoke(IPC.memoriesSearch, { query, projectPath }),
    saveMemory: (input) =>
      invoke(IPC.memorySave, input as Pick<MemoryRecord, 'content' | 'projectPath' | 'tags'> & {
        id?: string;
      }),
    deleteMemory: (id) => invoke(IPC.memoryDelete, id),
    listSites: () => invoke(IPC.sitesList),
    saveSite: (input) =>
      invoke(
        IPC.siteSave,
        input as Omit<SiteRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
      ),
    serveSite: (id, lan) => invoke(IPC.siteServe, { id, lan }),
    stopSite: (id) => invoke(IPC.siteStop, id),
    deleteSite: (id) => invoke(IPC.siteDelete, id),
    pickSiteDirectory: () => invoke(IPC.sitePickDirectory),
    indexStatus: (workDir) => invoke(IPC.indexStatus, workDir),
    assessProjectIndex: (workDir, additionalDirs) =>
      invoke(IPC.indexAssess, { workDir, additionalDirs }),
    activateProjectIndex: (workDir, additionalDirs, options) =>
      invoke(IPC.indexActivate, { workDir, additionalDirs, force: options?.force }),
    cancelProjectIndex: (workDir) => invoke(IPC.indexCancel, workDir),
    deactivateProjectIndex: (workDir) => invoke(IPC.indexDeactivate, workDir),
    rebuildProjectIndex: (workDir) => invoke(IPC.indexRebuild, workDir),
    searchProjectIndex: (input) => invoke(IPC.indexSearch, input),
    previewIndexContext: (input) => invoke(IPC.indexContextPreview, input),
    getSettings: () => invoke(IPC.settingsGet),
    setSettings: (patch: Partial<AppSettings>) => invoke(IPC.settingsSet, patch),
    revealLogs: async () => {
      console.info('[ganymede-web] revealLogs is only available in the desktop app.');
      await invoke(IPC.logsReveal);
    },
    onSessionEvent: (listener) => subscribe<EventEnvelope>(IPC.event, listener),
    onApproval: (listener) => subscribe<PendingApproval>(IPC.approval, listener),
    onQuestion: (listener) => subscribe<PendingQuestion>(IPC.question, listener),
    onDebugVerification: (listener) =>
      subscribe<PendingDebugVerification>(IPC.debugVerification, listener),
    onTerminalData: (listener) => subscribe<TerminalDataEvent>(IPC.terminalData, listener),
    onTerminalExit: (listener) =>
      subscribe<{ readonly id: string; readonly exitCode: number }>(IPC.terminalExit, listener),
    onBrowserState: (listener) => subscribe<BrowserTab>(IPC.browserState, listener),
    onAutomationState: (listener) => subscribe(IPC.automationState, () => listener()),
    onInboxState: (listener) => subscribe(IPC.inboxState, () => listener()),
    onNavigate: (listener) => subscribe<string>('app:navigate', listener),
    onOpenProjectRequest: (listener) => subscribe('app:open-project', () => listener()),
  };

  return api;
}
