import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  app,
  BrowserWindow,
  crashReporter,
  ipcMain,
  Menu,
  nativeTheme,
  Notification,
  shell,
} from 'electron';
import { z } from 'zod';
import { LocalKaos, SSHKaos } from '@moonshot-ai/kimi-code-sdk';

import {
  IPC,
  type AddCatalogProviderRequest,
  type AppSettings,
  type ApprovalResolution,
  type Automation,
  type CreateSessionRequest,
  type DebugVerificationResolution,
  type DefaultModelConfigurationRequest,
  type PromptRequest,
  type QuestionResolution,
  type SessionConfiguration,
  type SiteRecord,
} from '../shared/contracts';
import { AppStore } from './store';
import { SessionManager } from './session-manager';
import { WorkspaceService } from './workspace-service';
import { TerminalManager } from './terminal-manager';
import { BrowserManager } from './browser-manager';
import { AutomationManager } from './automation-manager';
import { ChromeBridge } from './native-bridge';
import { ComputerUse } from './computer-use';
import { createHostTools } from './host-tools';
import { NotificationBridge } from './notification-bridge';
import { ProjectIndexService } from './project-index/project-index-service';
import { rendererRoot, resourceRoot } from './app-paths';
import {
  closeLogging,
  createScopedLogger,
  flushLoggingSync,
  getLogDir,
  getLogFile,
  initLogging,
  isIpcTraceEnabled,
  loggingSettingsFrom,
  reconfigureLogging,
  revealLogs,
} from './logging';
import { WebDevBridge, type IpcHandlerEntry } from './web-dev-bridge';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_NAME = 'Ganymede Code';
const DISPLAY_NAME = '伽利略 Code';
const log = createScopedLogger('app');
const ipcLog = createScopedLogger('ipc');
const isWebDev = process.env['GANYMEDE_WEB_DEV'] === '1';
const webDevPort = Number(process.env['GANYMEDE_WEB_PORT'] ?? '5174') || 5174;

function macNativeShell(): boolean {
  return process.platform === 'darwin' && !isWebDev;
}

function resolveShellStyle(): 'macos-vibrancy' | 'opaque' {
  return macNativeShell() ? 'macos-vibrancy' : 'opaque';
}

let mainWindow: BrowserWindow | undefined;
let store: AppStore | undefined;
let sessions: SessionManager | undefined;
let workspace: WorkspaceService | undefined;
let projectIndex: ProjectIndexService | undefined;
let terminals: TerminalManager | undefined;
let browsers: BrowserManager | undefined;
let automations: AutomationManager | undefined;
let inboxBridge: NotificationBridge | undefined;
let chromeBridge: ChromeBridge | undefined;
let computerUse: ComputerUse | undefined;
let webBridge: WebDevBridge | undefined;
const ipcHandlers = new Map<string, IpcHandlerEntry>();

app.setName(APP_NAME);
crashReporter.start({ uploadToServer: false });

function emit(channel: string, payload: unknown): void {
  webBridge?.broadcast(channel, payload);
  if (mainWindow === undefined || mainWindow.isDestroyed()) return;
  if (isWebDev) return;
  mainWindow.webContents.send(channel, payload);
}

function notify(title: string, body: string): void {
  if (store?.getSettings().notifications !== true) return;
  if (Notification.isSupported()) new Notification({ title, body }).show();
}

async function createWindow(load = true): Promise<void> {
  const macVibrancy = macNativeShell();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    title: APP_NAME,
    show: !isWebDev,
    transparent: macVibrancy,
    backgroundColor: macVibrancy ? '#00000000' : '#101114',
    titleBarStyle: macVibrancy ? 'hiddenInset' : 'default',
    trafficLightPosition: macVibrancy ? { x: 18, y: 18 } : undefined,
    vibrancy: macVibrancy ? 'sidebar' : undefined,
    visualEffectState: macVibrancy ? 'followWindow' : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
      if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
    }
  });
  mainWindow.on('closed', () => {
    browsers?.closeAll();
    mainWindow = undefined;
  });

  if (load && !isWebDev) await loadRenderer();
}

async function loadRenderer(): Promise<void> {
  if (mainWindow === undefined) throw new Error('Main window is not ready.');
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl !== undefined) {
    await mainWindow.loadURL(rendererUrl);
  } else {
    await mainWindow.loadFile(join(rendererRoot(), 'index.html'));
  }
}

function initializeStore(): AppStore {
  if (store !== undefined) return store;
  const userData = app.getPath('userData');
  store = new AppStore(join(userData, 'ganymede.sqlite'), join(userData, 'worktrees'), {
    packaged: app.isPackaged,
  });
  return store;
}

async function initializeServices(): Promise<void> {
  const userData = app.getPath('userData');
  const worktreeRoot = join(userData, 'worktrees');
  const resources = resourceRoot();
  const appStore = initializeStore();
  initLogging(userData, loggingSettingsFrom(appStore.getSettings()));
  sessions = new SessionManager(
    appStore,
    join(userData, 'scratch'),
    emit,
    app.getVersion(),
    join(resources, 'skills'),
  );
  await sessions.initialize();
  workspace = new WorkspaceService(appStore, sessions, worktreeRoot);
  projectIndex = new ProjectIndexService(appStore, userData);
  workspace.setProjectIndex(projectIndex);
  sessions.setProjectIndex(projectIndex);
  terminals = new TerminalManager(emit);
  if (mainWindow === undefined) throw new Error('Main window is not ready.');
  browsers = new BrowserManager(mainWindow, emit, () => requireStore().getSettings());
  chromeBridge = new ChromeBridge(userData);
  await chromeBridge.start().catch((error: unknown) => {
    createScopedLogger('chrome-bridge').error('failed to start chrome bridge', error);
  });
  computerUse = new ComputerUse();
  inboxBridge = new NotificationBridge(appStore, emit, notify);
  sessions.setInboxEventHandler((envelope) => inboxBridge?.handleSessionEvent(envelope));
  automations = new AutomationManager(appStore, sessions, workspace, emit, inboxBridge);
  await sessions.setHostTools(buildHostTools(sessions));
  automations.start();
}

function buildHostTools(sessionManager: SessionManager) {
  return createHostTools({
    store: requireStore(),
    browser: browsers as BrowserManager,
    chrome: chromeBridge as ChromeBridge,
    computer: computerUse as ComputerUse,
    automations: requireAutomations(),
    workspace: requireWorkspace(),
    projectIndex: requireProjectIndex(),
    debug: {
      listProbes: (sessionId) => sessionManager.listDebugProbes(sessionId),
      registerProbe: (sessionId, input) => sessionManager.registerDebugProbe(sessionId, input),
      unregisterProbe: (sessionId, id) => sessionManager.unregisterDebugProbe(sessionId, id),
      requestVerification: (sessionId, input) =>
        sessionManager.requestDebugVerification(sessionId, input),
    },
  });
}

function registerIpc(): void {
  handle(IPC.bootstrap, z.undefined(), async () => {
    const settings = requireStore().getSettings();
    applyTheme(settings);
    return requireSessions().bootstrap({
      appName: APP_NAME,
      displayName: DISPLAY_NAME,
      version: app.getVersion(),
      platform: process.platform,
      shellStyle: resolveShellStyle(),
      userName: process.env['USER'] ?? process.env['USERNAME'] ?? homedir().split('/').at(-1) ?? 'G',
      settings,
      logDir: getLogDir(),
      logFile: getLogFile(),
    });
  });
  handle(IPC.openExternal, z.string().url(), async (url) => {
    await shell.openExternal(url);
  });
  handle(IPC.setAlwaysOnTop, z.boolean(), (enabled) => {
    mainWindow?.setAlwaysOnTop(enabled, 'floating');
  });
  handle(
    IPC.notify,
    z.object({ title: z.string().max(200), body: z.string().max(2_000) }),
    ({ title, body }) => notify(title, body),
  );
  handle(IPC.logsReveal, z.undefined(), () => revealLogs());

  handle(IPC.projectsList, z.undefined(), () => requireWorkspace().listProjects());
  handle(IPC.projectsListHidden, z.undefined(), () => requireWorkspace().listHiddenProjects());
  handle(IPC.projectOpen, z.undefined(), () => requireWorkspace().openProject());
  handle(IPC.projectRemove, z.string(), (workDir) => requireWorkspace().removeProject(workDir));
  handle(IPC.projectRestore, z.string(), (workDir) => requireWorkspace().restoreProject(workDir));
  handle(
    IPC.projectPin,
    z.object({ workDir: z.string(), pinned: z.boolean() }),
    ({ workDir, pinned }) => requireWorkspace().setProjectPinned(workDir, pinned),
  );
  handle(IPC.projectInspect, z.string(), (workDir) => requireWorkspace().inspectProject(workDir));
  handle(IPC.attachmentsPick, z.undefined(), () => requireWorkspace().pickAttachments());
  handle(
    IPC.projectAdditionalDir,
    z.object({ workDir: z.string(), sessionId: z.string().optional() }),
    async ({ workDir, sessionId }) => {
      const path = await requireWorkspace().pickAdditionalDirectory(workDir);
      if (path === undefined) return [];
      if (sessionId !== undefined) {
        const additionalDirs = await requireSessions().addAdditionalDir(sessionId, path);
        const project = await requireWorkspace().inspectProject(workDir);
        requireStore().upsertProject({ ...project, additionalDirs });
        return additionalDirs;
      }
      const project = await requireWorkspace().inspectProject(workDir);
      const additionalDirs = [...new Set([...project.additionalDirs, path])];
      requireStore().upsertProject({ ...project, additionalDirs });
      return additionalDirs;
    },
  );

  handle(
    IPC.sessionsList,
    z.object({ workDir: z.string().optional(), includeArchived: z.boolean().optional() }),
    ({ workDir, includeArchived }) => requireSessions().listSessions(workDir, includeArchived),
  );
  handle(IPC.sessionCreate, createSessionSchema, async (input) => {
    let request = input as CreateSessionRequest;
    if (request.target === 'worktree') {
      const worktree = await requireWorkspace().createWorktree(
        request.workDir,
        request.branch,
        true,
      );
      request = { ...request, workDir: worktree.path };
    }
    if (request.target === 'ssh') {
      const profile = requireStore()
        .getSettings()
        .sshProfiles.find((item) => item.id === request.sshProfileId);
      if (profile === undefined) throw new Error('请选择一个 SSH 连接配置。');
      const remote = await SSHKaos.create({
        host: profile.host,
        port: profile.port,
        username: profile.username,
        keyPaths: profile.keyPaths.map((path) =>
          path.startsWith('~/') ? join(homedir(), path.slice(2)) : path,
        ),
        cwd: profile.remotePath,
        acceptUnknownHost: profile.trustUnknownHost,
        hostVerifier:
          profile.hostKeySha256 === undefined
            ? undefined
            : (key) =>
                `SHA256:${createHash('sha256').update(key).digest('base64')}` ===
                profile.hostKeySha256,
        extraOptions: {
          agent: process.env['SSH_AUTH_SOCK'],
          keepaliveInterval: 15_000,
          readyTimeout: 20_000,
        },
      });
      const local = await LocalKaos.create();
      request = { ...request, workDir: profile.remotePath };
      return requireSessions().createSession(request, {
        kaos: remote,
        persistenceKaos: local,
      });
    }
    return requireSessions().createSession(request);
  });
  handle(IPC.sessionResume, z.string(), (id) => requireSessions().resumeSession(id));
  handle(IPC.sessionSnapshot, z.string(), (id) => requireSessions().snapshotById(id));
  handle(IPC.sessionPrompt, promptSchema, (input) =>
    requireSessions().prompt(input as PromptRequest),
  );
  handle(IPC.sessionSteer, promptSchema, (input) =>
    requireSessions().steer(input as PromptRequest),
  );
  handle(IPC.sessionCancel, z.string(), (id) => requireSessions().cancel(id));
  handle(IPC.sessionArchive, z.string(), (id) => requireSessions().archive(id));
  handle(
    IPC.sessionPin,
    z.object({ id: z.string(), pinned: z.boolean() }),
    ({ id, pinned }) => requireSessions().pin(id, pinned),
  );
  handle(
    IPC.sessionRename,
    z.object({ id: z.string(), title: z.string().min(1).max(300) }),
    ({ id, title }) => requireSessions().rename(id, title),
  );
  handle(
    IPC.sessionFork,
    z.object({ id: z.string(), workDir: z.string().optional() }),
    ({ id, workDir }) => requireSessions().fork(id, workDir),
  );
  handle(
    IPC.sessionConfigure,
    z.object({ id: z.string(), config: z.record(z.string(), z.unknown()) }),
    ({ id, config }) => requireSessions().configure(id, config as SessionConfiguration),
  );
  handle(
    IPC.sessionCompact,
    z.object({ id: z.string(), instruction: z.string().optional() }),
    ({ id, instruction }) => requireSessions().compact(id, instruction),
  );
  handle(IPC.sessionInit, z.string(), (id) => requireSessions().init(id));
  handle(IPC.sessionUsage, z.string(), (id) => requireSessions().getUsage(id));
  handle(IPC.sessionClearPlan, z.string(), (id) => requireSessions().clearPlan(id));
  handle(IPC.sessionClose, z.string(), (id) => requireSessions().closeSession(id));
  handle(IPC.plansList, z.string(), (workDir) => requireSessions().listProjectPlans(workDir));
  handle(
    IPC.planRead,
    z.object({
      path: z.string(),
      workDir: z.string().optional(),
    }),
    (input) => requireSessions().readPlanFile(input.path, input.workDir),
  );
  handle(
    IPC.planPatchTodos,
    z.object({
      sessionId: z.string(),
      path: z.string(),
      todos: z.array(
        z.object({
          id: z.string(),
          content: z.string(),
          status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
        }),
      ),
    }),
    (input) => requireSessions().patchPlanTodos(input),
  );
  handle(
    IPC.approvalResolve,
    z.record(z.string(), z.unknown()),
    (input) => requireSessions().resolveApproval(input as unknown as ApprovalResolution),
  );
  handle(
    IPC.questionResolve,
    z.record(z.string(), z.unknown()),
    (input) => requireSessions().resolveQuestion(input as unknown as QuestionResolution),
  );
  handle(
    IPC.debugVerificationResolve,
    z.object({
      id: z.string(),
      outcome: z.enum(['fixed', 'not_fixed', 'cancelled']),
      userNotes: z.string().optional(),
    }),
    (input) =>
      requireSessions().resolveDebugVerification(input as DebugVerificationResolution),
  );

  handle(IPC.authStatus, z.undefined(), () => requireSessions().authStatus());
  handle(IPC.authLogin, z.undefined(), () =>
    requireSessions().authLogin((url) => shell.openExternal(url)),
  );
  handle(IPC.authLogout, z.undefined(), () => requireSessions().authLogout());
  handle(IPC.modelsGet, z.undefined(), () => requireSessions().modelConfiguration());
  handle(
    IPC.modelsConfigureDefault,
    modelSelectionSchema,
    (input) =>
      requireSessions().configureDefaultModel(input as DefaultModelConfigurationRequest),
  );
  handle(IPC.modelsCatalogList, z.undefined(), () => requireSessions().listModelCatalog());
  handle(
    IPC.modelsCatalogAdd,
    modelSelectionSchema.extend({
      providerId: z.string().trim().min(1),
      apiKey: z.string().trim().min(1),
    }),
    (input) => requireSessions().addCatalogProvider(input as AddCatalogProviderRequest),
  );
  handle(
    IPC.billingDeepSeekSnapshot,
    z
      .object({
        sessionId: z.string().optional(),
        refreshBalance: z.boolean().optional(),
      })
      .optional(),
    (input) => requireSessions().deepSeekBillingSnapshot(input ?? {}),
  );
  handle(
    IPC.contextUsageSnapshot,
    z.object({ sessionId: z.string().min(1) }),
    (input) => requireSessions().contextUsageSnapshot(input),
  );

  handle(IPC.gitStatus, z.string(), (cwd) => requireWorkspace().gitStatus(cwd));
  handle(IPC.gitInit, z.string(), (cwd) => requireWorkspace().gitInit(cwd));
  handle(
    IPC.gitDiff,
    z.object({ cwd: z.string(), staged: z.boolean().optional(), file: z.string().optional() }),
    ({ cwd, staged, file }) => requireWorkspace().gitDiff(cwd, staged, file),
  );
  handle(IPC.gitStage, gitPathsSchema, ({ cwd, paths }) =>
    requireWorkspace().gitStage(cwd, paths),
  );
  handle(IPC.gitUnstage, gitPathsSchema, ({ cwd, paths }) =>
    requireWorkspace().gitUnstage(cwd, paths),
  );
  handle(IPC.gitRevert, gitPathsSchema, ({ cwd, paths }) =>
    requireWorkspace().gitRevert(cwd, paths),
  );
  handle(
    IPC.gitCommit,
    z.object({ cwd: z.string(), message: z.string() }),
    ({ cwd, message }) => requireWorkspace().gitCommit(cwd, message),
  );
  handle(IPC.gitPush, z.string(), (cwd) => requireWorkspace().gitPush(cwd));
  handle(IPC.gitFetch, z.string(), (cwd) => requireWorkspace().gitFetch(cwd));
  handle(IPC.gitPull, z.string(), (cwd) => requireWorkspace().gitPull(cwd));
  handle(
    IPC.gitCheckout,
    z.object({ cwd: z.string(), branch: z.string().min(1) }),
    ({ cwd, branch }) => requireWorkspace().gitCheckout(cwd, branch),
  );
  handle(
    IPC.gitCreateBranch,
    z.object({ cwd: z.string(), name: z.string().min(1) }),
    ({ cwd, name }) => requireWorkspace().gitCreateBranch(cwd, name),
  );
  handle(IPC.gitBranches, z.string(), (cwd) => requireWorkspace().gitBranches(cwd));
  handle(
    IPC.gitPullRequests,
    z.object({
      workDir: z.string(),
      state: z.enum(['open', 'closed', 'merged', 'all']).optional(),
    }),
    ({ workDir, state }) => requireWorkspace().pullRequests(workDir, state),
  );
  handle(
    IPC.gitPullRequestDetail,
    z.object({ cwd: z.string(), number: z.number().int().positive() }),
    ({ cwd, number }) => requireWorkspace().pullRequestDetail(cwd, number),
  );
  handle(
    IPC.gitPullRequestCreate,
    z.object({ cwd: z.string(), title: z.string().min(1), body: z.string() }),
    ({ cwd, title, body }) => requireWorkspace().createPullRequest(cwd, title, body),
  );
  handle(IPC.gitWorktrees, z.string(), (cwd) => requireWorkspace().worktrees(cwd));
  handle(
    IPC.worktreeCreate,
    z.object({
      cwd: z.string(),
      branch: z.string().optional(),
      includeChanges: z.boolean().optional(),
    }),
    ({ cwd, branch, includeChanges }) =>
      requireWorkspace().createWorktree(cwd, branch, includeChanges),
  );
  handle(
    IPC.worktreeRemove,
    z.object({ cwd: z.string(), path: z.string() }),
    ({ cwd, path }) => requireWorkspace().removeWorktree(cwd, path),
  );
  handle(
    IPC.worktreeHandoff,
    z.object({ source: z.string(), target: z.string() }),
    ({ source, target }) => requireWorkspace().handoffWorktree(source, target),
  );

  handle(IPC.filesList, z.string(), (root) => requireWorkspace().listFiles(root));
  handle(
    IPC.filesSearch,
    z.object({ root: z.string(), query: z.string().max(1_000) }),
    ({ root, query }) => requireWorkspace().searchWorkspacePaths(root, query),
  );
  handle(
    IPC.fileRead,
    z.object({ root: z.string(), path: z.string() }),
    ({ root, path }) => requireWorkspace().readWorkspaceFile(root, path),
  );
  handle(
    IPC.fileWrite,
    z.object({ root: z.string(), path: z.string(), content: z.string() }),
    ({ root, path, content }) => requireWorkspace().writeWorkspaceFile(root, path, content),
  );
  handle(IPC.fileReveal, z.string(), (path) => requireWorkspace().revealFile(path));
  handle(IPC.fileOpenExternal, z.string(), (path) =>
    requireWorkspace().openFileExternal(path),
  );
  handle(
    IPC.filePreview,
    z.object({ root: z.string(), path: z.string() }),
    ({ root, path }) => requireWorkspace().previewWorkspaceFile(root, path),
  );
  handle(
    IPC.fileOpenInEditor,
    z.object({ path: z.string(), command: z.string().optional() }),
    ({ path, command }) => requireWorkspace().openInEditor(path, command),
  );
  handle(IPC.fileOpenInTerminal, z.string(), (path) =>
    requireWorkspace().openInTerminal(path),
  );
  handle(IPC.editorsList, z.undefined(), () => requireWorkspace().listAvailableEditors());

  handle(
    IPC.terminalCreate,
    z.object({ cwd: z.string(), sessionId: z.string().optional() }),
    ({ cwd, sessionId }) =>
      requireTerminals().create(cwd, sessionId, requireStore().getSettings().terminalShell),
  );
  handle(
    IPC.terminalInput,
    z.object({ id: z.string(), data: z.string() }),
    ({ id, data }) => requireTerminals().input(id, data),
  );
  handle(
    IPC.terminalResize,
    z.object({ id: z.string(), cols: z.number(), rows: z.number() }),
    ({ id, cols, rows }) => requireTerminals().resize(id, cols, rows),
  );
  handle(IPC.terminalClose, z.string(), (id) => requireTerminals().close(id));

  handle(
    IPC.browserCreate,
    z.object({ sessionId: z.string().optional(), url: z.string().optional() }),
    ({ sessionId, url }) => requireBrowsers().create(sessionId, url),
  );
  handle(
    IPC.browserNavigate,
    z.object({ id: z.string(), url: z.string() }),
    ({ id, url }) => requireBrowsers().navigate(id, url),
  );
  handle(
    IPC.browserAction,
    z.object({
      id: z.string(),
      action: z.enum([
        'back',
        'forward',
        'reload',
        'stop',
        'zoom-in',
        'zoom-out',
        'zoom-reset',
        'fit',
        'devtools',
      ]),
    }),
    ({ id, action }) => requireBrowsers().action(id, action),
  );
  handle(
    IPC.browserBounds,
    z.object({
      id: z.string(),
      bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    }),
    ({ id, bounds }) => requireBrowsers().setBounds(id, bounds),
  );
  handle(IPC.browserHide, z.string(), (id) => requireBrowsers().hide(id));
  handle(IPC.browserClose, z.string(), (id) => requireBrowsers().close(id));
  handle(IPC.browserScreenshot, z.string(), (id) => requireBrowsers().screenshot(id));
  handle(IPC.browserAnnotate, z.string(), (id) => requireBrowsers().annotate(id));

  handle(
    IPC.pluginsList,
    z.object({ sessionId: z.string().optional() }),
    ({ sessionId }) => requireSessions().listPlugins(sessionId),
  );
  handle(
    IPC.pluginInstall,
    z.object({ source: z.string(), sessionId: z.string().optional() }),
    ({ source, sessionId }) => requireSessions().installPlugin(source, sessionId),
  );
  handle(
    IPC.pluginEnable,
    z.object({ id: z.string(), enabled: z.boolean(), sessionId: z.string().optional() }),
    ({ id, enabled, sessionId }) => requireSessions().enablePlugin(id, enabled, sessionId),
  );
  handle(
    IPC.pluginMcpEnable,
    z.object({
      id: z.string(),
      server: z.string(),
      enabled: z.boolean(),
      sessionId: z.string().optional(),
    }),
    ({ id, server, enabled, sessionId }) =>
      requireSessions().enablePluginMcp(id, server, enabled, sessionId),
  );
  handle(
    IPC.pluginRemove,
    z.object({ id: z.string(), sessionId: z.string().optional() }),
    ({ id, sessionId }) => requireSessions().removePlugin(id, sessionId),
  );
  handle(
    IPC.skillsList,
    z.object({ sessionId: z.string().optional(), workDir: z.string().optional() }),
    ({ sessionId, workDir }) => requireSessions().listSkills(sessionId, workDir),
  );
  handle(
    IPC.skillActivate,
    z.object({
      sessionId: z.string().optional(),
      name: z.string(),
      args: z.string().optional(),
      workDir: z.string().optional(),
    }),
    ({ sessionId, name, args, workDir }) =>
      requireSessions().activateSkill(sessionId, name, args, workDir),
  );
  handle(
    IPC.pluginCommandsList,
    z.object({ sessionId: z.string().optional() }),
    ({ sessionId }) => requireSessions().listPluginCommands(sessionId),
  );
  handle(
    IPC.pluginCommandActivate,
    z.object({
      sessionId: z.string().optional(),
      pluginId: z.string(),
      commandName: z.string(),
      args: z.string().optional(),
      workDir: z.string().optional(),
    }),
    ({ sessionId, pluginId, commandName, args, workDir }) =>
      requireSessions().activatePluginCommand(sessionId, pluginId, commandName, args, workDir),
  );
  handle(
    IPC.mcpList,
    z.object({ sessionId: z.string().optional() }),
    ({ sessionId }) => requireSessions().listMcp(sessionId),
  );
  handle(
    IPC.mcpReconnect,
    z.object({ id: z.string().optional(), name: z.string() }),
    ({ id, name }) => requireSessions().reconnectMcp(id, name),
  );
  handle(
    IPC.pluginsMarketplace,
    z.object({ sessionId: z.string().optional(), workDir: z.string().optional() }),
    ({ sessionId, workDir }) => requireSessions().listPluginMarketplace(sessionId, workDir),
  );
  handle(IPC.backgroundTasksList, z.string(), (sessionId) =>
    requireSessions().listBackgroundTasks(sessionId),
  );
  handle(
    IPC.backgroundTaskOutput,
    z.object({ sessionId: z.string(), taskId: z.string(), tail: z.number().int().positive().optional() }),
    ({ sessionId, taskId, tail }) =>
      requireSessions().getBackgroundTaskOutput(sessionId, taskId, tail),
  );
  handle(
    IPC.backgroundTaskStop,
    z.object({ sessionId: z.string(), taskId: z.string() }),
    ({ sessionId, taskId }) => requireSessions().stopBackgroundTask(sessionId, taskId),
  );

  handle(IPC.automationsList, z.undefined(), () => requireAutomations().list());
  handle(
    IPC.automationSave,
    z.record(z.string(), z.unknown()),
    (input) => requireAutomations().save(input as unknown as Omit<Automation, 'id' | 'createdAt'> & { id?: string }),
  );
  handle(IPC.automationDelete, z.string(), (id) => requireAutomations().delete(id));
  handle(IPC.automationRun, z.string(), (id) => requireAutomations().run(id));
  handle(IPC.inboxList, z.undefined(), () => requireStore().listInbox());
  handle(IPC.inboxRead, z.string(), (id) => requireInbox().markRead(id));
  handle(IPC.inboxDelete, z.string(), (id) => requireInbox().delete(id));
  handle(IPC.inboxMarkAllRead, z.undefined(), () => requireInbox().markAllRead());
  handle(IPC.inboxUnreadCount, z.undefined(), () => requireInbox().unreadCount());
  handle(
    IPC.memoriesSearch,
    z.object({ query: z.string(), projectPath: z.string().optional() }),
    ({ query, projectPath }) => requireStore().searchMemories(query, projectPath),
  );
  handle(
    IPC.memorySave,
    z.object({
      id: z.string().optional(),
      projectPath: z.string().optional(),
      content: z.string().min(1),
      tags: z.array(z.string()),
    }),
    (input) => requireStore().saveMemory(input),
  );
  handle(IPC.memoryDelete, z.string(), (id) => requireStore().deleteMemory(id));
  handle(IPC.sitesList, z.undefined(), () => requireWorkspace().listSites());
  handle(
    IPC.siteSave,
    z.record(z.string(), z.unknown()),
    (input) => requireWorkspace().saveSite(input as unknown as Omit<SiteRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }),
  );
  handle(
    IPC.siteServe,
    z.object({ id: z.string(), lan: z.boolean().optional() }),
    ({ id, lan }) => requireWorkspace().serveSite(id, lan),
  );
  handle(IPC.siteStop, z.string(), (id) => requireWorkspace().stopSite(id));
  handle(IPC.siteDelete, z.string(), (id) => requireWorkspace().deleteSite(id));
  handle(IPC.sitePickDirectory, z.undefined(), () => requireWorkspace().pickSiteDirectory());
  handle(IPC.indexStatus, z.string(), (workDir) => requireProjectIndex().status(workDir));
  handle(
    IPC.indexAssess,
    z.object({
      workDir: z.string(),
      additionalDirs: z.array(z.string()).optional(),
    }),
    ({ workDir, additionalDirs }) =>
      requireProjectIndex().assessProject(workDir, additionalDirs ?? []),
  );
  handle(
    IPC.indexActivate,
    z.object({
      workDir: z.string(),
      additionalDirs: z.array(z.string()).optional(),
      force: z.boolean().optional(),
    }),
    async ({ workDir, additionalDirs, force }) => {
      await requireProjectIndex().activateProject(workDir, additionalDirs ?? [], { force });
      return requireProjectIndex().status(workDir);
    },
  );
  handle(IPC.indexCancel, z.string(), (workDir) => requireProjectIndex().cancelIndex(workDir));
  handle(IPC.indexDeactivate, z.string(), (workDir) =>
    requireProjectIndex().deactivateProject(workDir),
  );
  handle(IPC.indexRebuild, z.string(), (workDir) => requireProjectIndex().rebuild(workDir));
  handle(
    IPC.indexSearch,
    z.object({
      workDir: z.string(),
      query: z.string().min(1).max(2_000),
      additionalDirs: z.array(z.string()).optional(),
      mode: z.enum(['hybrid', 'semantic', 'lexical']).optional(),
      limit: z.number().int().positive().max(50).optional(),
    }),
    (input) => requireProjectIndex().search(input),
  );
  handle(
    IPC.indexContextPreview,
    z.object({
      workDir: z.string(),
      additionalDirs: z.array(z.string()).optional(),
      references: z.array(z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('path'),
          root: z.string().min(1),
          path: z.string().min(1),
          name: z.string().min(1).max(500),
          pathKind: z.enum(['file', 'directory']),
        }),
        z.object({
          kind: z.literal('skill'),
          name: z.string().min(1).max(200),
        }),
        z.object({
          kind: z.literal('session'),
          sessionId: z.string().min(1),
          title: z.string().min(1).max(300),
        }),
        z.object({
          kind: z.literal('codebase'),
          query: z.string().min(1).max(2_000),
          limit: z.number().int().positive().max(50).optional(),
        }),
      ])).max(64),
    }),
    (input) => requireSessions().previewIndexContext(input),
  );
  handle(IPC.settingsGet, z.undefined(), () => requireStore().getSettings());
  handle(
    IPC.settingsSet,
    z.record(z.string(), z.unknown()),
    async (patch) => {
      const settings = requireStore().setSettings(patch as Partial<AppSettings>);
      reconfigureLogging(loggingSettingsFrom(settings));
      applyTheme(settings);
      if (patch['indexEnabled'] === false) {
        await requireProjectIndex().close();
      }
      return settings;
    },
  );
}

function configureMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: '设置…',
          accelerator: 'CmdOrCtrl+,',
          click: () => emit('app:navigate', 'settings'),
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: '文件',
      submenu: [
        {
          label: '新建任务',
          accelerator: 'CmdOrCtrl+N',
          click: () => emit('app:navigate', 'new'),
        },
        {
          label: '打开项目…',
          accelerator: 'CmdOrCtrl+O',
          click: () => emit('app:open-project', undefined),
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function applyTheme(settings: AppSettings): void {
  nativeTheme.themeSource = settings.theme;
}

function handle<TSchema extends z.ZodType, TResult>(
  channel: string,
  schema: TSchema,
  handler: (input: z.infer<TSchema>) => TResult | Promise<TResult>,
): void {
  const entry: IpcHandlerEntry = {
    schema,
    handler: (input) => handler(input as z.infer<TSchema>),
  };
  ipcHandlers.set(channel, entry);
  ipcMain.handle(channel, async (_event, raw: unknown) => {
    const started = Date.now();
    try {
      const input = schema.parse(raw);
      const result = await handler(input);
      if (isIpcTraceEnabled()) {
        ipcLog.debug('handled', { channel, ms: Date.now() - started });
      }
      return result;
    } catch (error: unknown) {
      ipcLog.error('handler failed', { channel, ms: Date.now() - started, error });
      throw error;
    }
  });
}

async function startWebDevBridge(): Promise<void> {
  webBridge = new WebDevBridge({
    port: webDevPort,
    handlers: ipcHandlers,
    onLog: (message) => log.info(message),
  });
  const port = await webBridge.start();
  const rendererUrl =
    process.env['ELECTRON_RENDERER_URL'] ??
    `http://localhost:${process.env['GANYMEDE_RENDERER_PORT'] ?? '5173'}`;
  process.stdout.write(`[ganymede] Web UI → ${rendererUrl}  (API on ${port})\n`);
}

function requireStore(): AppStore {
  if (store === undefined) throw new Error('Store is not initialized.');
  return store;
}

function requireSessions(): SessionManager {
  if (sessions === undefined) throw new Error('Session manager is not initialized.');
  return sessions;
}

function requireWorkspace(): WorkspaceService {
  if (workspace === undefined) throw new Error('Workspace service is not initialized.');
  return workspace;
}

function requireProjectIndex(): ProjectIndexService {
  if (projectIndex === undefined) throw new Error('Project index is not initialized.');
  return projectIndex;
}

function requireTerminals(): TerminalManager {
  if (terminals === undefined) throw new Error('Terminal manager is not initialized.');
  return terminals;
}

function requireBrowsers(): BrowserManager {
  if (browsers === undefined) throw new Error('Browser manager is not initialized.');
  return browsers;
}

function requireAutomations(): AutomationManager {
  if (automations === undefined) throw new Error('Automation manager is not initialized.');
  return automations;
}

function requireInbox(): NotificationBridge {
  if (inboxBridge === undefined) throw new Error('Inbox bridge is not initialized.');
  return inboxBridge;
}

const createSessionSchema = z.object({
  workDir: z.string().min(1),
  model: z.string().optional(),
  thinking: z.string().optional(),
  permission: z.enum(['manual', 'auto', 'yolo']).optional(),
  interactionMode: z.enum(['agent', 'plan', 'debug', 'multitask', 'ask', 'engineering']).optional(),
  planMode: z.boolean().optional(),
  target: z.enum(['local', 'worktree', 'ssh']).optional(),
  branch: z.string().optional(),
  additionalDirs: z.array(z.string()).optional(),
  sshProfileId: z.string().optional(),
});
const modelSelectionSchema = z.object({
  model: z.string().trim().min(1),
  thinking: z.string().trim().min(1),
});
const promptSchema = z.object({
  sessionId: z.string().min(1),
  text: z.string(),
  attachments: z.array(z.object({
    kind: z.enum(['image', 'video', 'file']),
    name: z.string(),
    path: z.string(),
    dataUrl: z.string().optional(),
    browserAnnotation: z.object({
      id: z.string(),
      url: z.string(),
      title: z.string(),
      selector: z.string(),
      tag: z.string(),
      text: z.string(),
      html: z.string(),
      rect: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
      screenshot: z.string(),
    }).optional(),
  })).optional(),
  references: z.array(z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('path'),
      root: z.string().min(1),
      path: z.string().min(1),
      name: z.string().min(1).max(500),
      pathKind: z.enum(['file', 'directory']),
    }),
    z.object({
      kind: z.literal('skill'),
      name: z.string().min(1).max(200),
    }),
    z.object({
      kind: z.literal('session'),
      sessionId: z.string().min(1),
      title: z.string().min(1).max(300),
    }),
    z.object({
      kind: z.literal('codebase'),
      query: z.string().min(1).max(2_000),
      limit: z.number().int().positive().max(50).optional(),
    }),
  ])).max(64).optional(),
});
const gitPathsSchema = z.object({
  cwd: z.string(),
  paths: z.array(z.string()),
});

app.whenReady().then(async () => {
  app.setAsDefaultProtocolClient('ganymede');
  if (!isWebDev) configureMenu();
  applyTheme(initializeStore().getSettings());
  registerIpc();
  await createWindow(false);
  if (isWebDev) {
    // Listen early so Vite's /api proxy has a target while services initialize.
    await startWebDevBridge();
    await initializeServices();
    webBridge?.setReady(true);
  } else {
    await initializeServices();
    await loadRenderer();
  }
  app.on('activate', () => {
    if (isWebDev) return;
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow(false).then(async () => {
        if (mainWindow !== undefined) {
          browsers = new BrowserManager(mainWindow, emit, () => requireStore().getSettings());
          await requireSessions().setHostTools(buildHostTools(requireSessions()));
        }
        await loadRenderer();
      });
    }
  });
}).catch((error: unknown) => {
  dialogError(error);
  app.quit();
});

process.on('uncaughtException', (error) => {
  log.error('uncaught exception', error);
  flushLoggingSync();
});

process.on('unhandledRejection', (reason) => {
  log.error('unhandled rejection', reason);
  flushLoggingSync();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (sessions === undefined) return;
  event.preventDefault();
  const currentSessions = sessions;
  sessions = undefined;
  automations?.stop();
  terminals?.closeAll();
  browsers?.closeAll();
  computerUse?.close();
  void Promise.allSettled([
    currentSessions.close(),
    workspace?.close() ?? Promise.resolve(),
    projectIndex?.close() ?? Promise.resolve(),
    chromeBridge?.stop() ?? Promise.resolve(),
    webBridge?.stop() ?? Promise.resolve(),
  ]).finally(() => {
    webBridge = undefined;
    flushLoggingSync();
    void closeLogging().finally(() => {
      store?.close();
      app.exit(0);
    });
  });
});

function dialogError(error: unknown): void {
  log.error('fatal startup error', error);
  flushLoggingSync();
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
}
