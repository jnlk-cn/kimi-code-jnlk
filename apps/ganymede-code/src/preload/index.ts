import { contextBridge, ipcRenderer } from 'electron';

import { IPC, type DesktopApi, type ShellStyle } from '../shared/contracts';

function resolveShellStyle(): ShellStyle {
  // Sandboxed preloads already inject `process`; importing node:process makes the
  // bundled CommonJS script redeclare it and prevents the entire bridge from loading.
  if (process.platform === 'darwin' && process.env['GANYMEDE_WEB_DEV'] !== '1') {
    return 'macos-vibrancy';
  }
  return 'opaque';
}

window.addEventListener(
  'DOMContentLoaded',
  () => {
    document.documentElement.dataset['shell'] = resolveShellStyle();
  },
  { once: true },
);

function invoke<T>(channel: string, input?: unknown): Promise<T> {
  return ipcRenderer.invoke(channel, input) as Promise<T>;
}

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api: DesktopApi = {
  bootstrap: () => invoke(IPC.bootstrap),
  openExternal: (url) => invoke(IPC.openExternal, url),
  setAlwaysOnTop: (enabled) => invoke(IPC.setAlwaysOnTop, enabled),
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
  createSession: (input) => invoke(IPC.sessionCreate, input),
  resumeSession: (sessionId) => invoke(IPC.sessionResume, sessionId),
  sessionSnapshot: (sessionId) => invoke(IPC.sessionSnapshot, sessionId),
  prompt: (input) => invoke(IPC.sessionPrompt, input),
  steer: (input) => invoke(IPC.sessionSteer, input),
  cancelSession: (sessionId) => invoke(IPC.sessionCancel, sessionId),
  archiveSession: (sessionId) => invoke(IPC.sessionArchive, sessionId),
  pinSession: (id, pinned) => invoke(IPC.sessionPin, { id, pinned }),
  renameSession: (id, title) => invoke(IPC.sessionRename, { id, title }),
  forkSession: (id, workDir) => invoke(IPC.sessionFork, { id, workDir }),
  configureSession: (id, config) => invoke(IPC.sessionConfigure, { id, config }),
  compactSession: (sessionId, instruction) =>
    invoke(IPC.sessionCompact, { id: sessionId, instruction }),
  initSession: (sessionId) => invoke(IPC.sessionInit, sessionId),
  getSessionUsage: (sessionId) => invoke(IPC.sessionUsage, sessionId),
  clearSessionPlan: (sessionId) => invoke(IPC.sessionClearPlan, sessionId),
  closeSession: (sessionId) => invoke(IPC.sessionClose, sessionId),
  listProjectPlans: (workDir) => invoke(IPC.plansList, workDir),
  readPlanFile: (input) => invoke(IPC.planRead, input),
  patchPlanTodos: (input) => invoke(IPC.planPatchTodos, input),
  resolveApproval: (input) => invoke(IPC.approvalResolve, input),
  resolveQuestion: (input) => invoke(IPC.questionResolve, input),
  resolveDebugVerification: (input) => invoke(IPC.debugVerificationResolve, input),
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
  browserAction: (id, action) => invoke(IPC.browserAction, { id, action }),
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
  saveAutomation: (input) => invoke(IPC.automationSave, input),
  deleteAutomation: (id) => invoke(IPC.automationDelete, id),
  runAutomation: (id) => invoke(IPC.automationRun, id),
  listInbox: () => invoke(IPC.inboxList),
  markInboxRead: (id) => invoke(IPC.inboxRead, id),
  deleteInbox: (id) => invoke(IPC.inboxDelete, id),
  markAllInboxRead: () => invoke(IPC.inboxMarkAllRead),
  inboxUnreadCount: () => invoke(IPC.inboxUnreadCount),
  searchMemories: (query, projectPath) =>
    invoke(IPC.memoriesSearch, { query, projectPath }),
  saveMemory: (input) => invoke(IPC.memorySave, input),
  deleteMemory: (id) => invoke(IPC.memoryDelete, id),
  listSites: () => invoke(IPC.sitesList),
  saveSite: (input) => invoke(IPC.siteSave, input),
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
  setSettings: (patch) => invoke(IPC.settingsSet, patch),
  revealLogs: () => invoke(IPC.logsReveal),
  onSessionEvent: (listener) => subscribe(IPC.event, listener),
  onApproval: (listener) => subscribe(IPC.approval, listener),
  onQuestion: (listener) => subscribe(IPC.question, listener),
  onDebugVerification: (listener) => subscribe(IPC.debugVerification, listener),
  onTerminalData: (listener) => subscribe(IPC.terminalData, listener),
  onTerminalExit: (listener) => subscribe(IPC.terminalExit, listener),
  onBrowserState: (listener) => subscribe(IPC.browserState, listener),
  onAutomationState: (listener) => subscribe(IPC.automationState, listener),
  onInboxState: (listener) => subscribe(IPC.inboxState, listener),
  onNavigate: (listener) => subscribe('app:navigate', listener),
  onOpenProjectRequest: (listener) => subscribe('app:open-project', () => listener()),
};

contextBridge.exposeInMainWorld('ganymede', api);
