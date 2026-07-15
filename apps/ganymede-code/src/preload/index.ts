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
  openProject: () => invoke(IPC.projectOpen),
  removeProject: (workDir) => invoke(IPC.projectRemove, workDir),
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
  closeSession: (sessionId) => invoke(IPC.sessionClose, sessionId),
  resolveApproval: (input) => invoke(IPC.approvalResolve, input),
  resolveQuestion: (input) => invoke(IPC.questionResolve, input),
  authStatus: () => invoke(IPC.authStatus),
  authLogin: () => invoke(IPC.authLogin),
  authLogout: () => invoke(IPC.authLogout),
  modelConfiguration: () => invoke(IPC.modelsGet),
  configureDefaultModel: (input) => invoke(IPC.modelsConfigureDefault, input),
  listModelCatalog: () => invoke(IPC.modelsCatalogList),
  addCatalogProvider: (input) => invoke(IPC.modelsCatalogAdd, input),
  gitStatus: (workDir) => invoke(IPC.gitStatus, workDir),
  gitDiff: (cwd, staged, file) => invoke(IPC.gitDiff, { cwd, staged, file }),
  gitStage: (cwd, paths) => invoke(IPC.gitStage, { cwd, paths }),
  gitUnstage: (cwd, paths) => invoke(IPC.gitUnstage, { cwd, paths }),
  gitRevert: (cwd, paths) => invoke(IPC.gitRevert, { cwd, paths }),
  gitCommit: (cwd, message) => invoke(IPC.gitCommit, { cwd, message }),
  gitPush: (workDir) => invoke(IPC.gitPush, workDir),
  gitBranches: (workDir) => invoke(IPC.gitBranches, workDir),
  pullRequests: (workDir) => invoke(IPC.gitPullRequests, workDir),
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
  listPluginCommands: (sessionId) => invoke(IPC.pluginCommandsList, sessionId),
  activatePluginCommand: (sessionId, pluginId, commandName, args) =>
    invoke(IPC.pluginCommandActivate, { sessionId, pluginId, commandName, args }),
  listSkills: (sessionId, workDir) => invoke(IPC.skillsList, { sessionId, workDir }),
  activateSkill: (sessionId, name, args) =>
    invoke(IPC.skillActivate, { sessionId, name, args }),
  listMcp: (sessionId) => invoke(IPC.mcpList, sessionId),
  reconnectMcp: (id, name) => invoke(IPC.mcpReconnect, { id, name }),
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
  searchMemories: (query, projectPath) =>
    invoke(IPC.memoriesSearch, { query, projectPath }),
  saveMemory: (input) => invoke(IPC.memorySave, input),
  deleteMemory: (id) => invoke(IPC.memoryDelete, id),
  listSites: () => invoke(IPC.sitesList),
  saveSite: (input) => invoke(IPC.siteSave, input),
  serveSite: (id, lan) => invoke(IPC.siteServe, { id, lan }),
  getSettings: () => invoke(IPC.settingsGet),
  setSettings: (patch) => invoke(IPC.settingsSet, patch),
  revealLogs: () => invoke(IPC.logsReveal),
  onSessionEvent: (listener) => subscribe(IPC.event, listener),
  onApproval: (listener) => subscribe(IPC.approval, listener),
  onQuestion: (listener) => subscribe(IPC.question, listener),
  onTerminalData: (listener) => subscribe(IPC.terminalData, listener),
  onTerminalExit: (listener) => subscribe(IPC.terminalExit, listener),
  onBrowserState: (listener) => subscribe(IPC.browserState, listener),
  onAutomationState: (listener) => subscribe(IPC.automationState, listener),
  onNavigate: (listener) => subscribe('app:navigate', listener),
  onOpenProjectRequest: (listener) => subscribe('app:open-project', () => listener()),
};

contextBridge.exposeInMainWorld('ganymede', api);
