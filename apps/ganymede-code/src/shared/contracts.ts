import type { LogLevel } from './logging';

export type { LogLevel } from './logging';

export const IPC = {
  bootstrap: 'app:bootstrap',
  openExternal: 'app:open-external',
  openSettings: 'app:open-settings',
  setAlwaysOnTop: 'app:set-always-on-top',
  notify: 'app:notify',
  logsReveal: 'logs:reveal',
  projectsList: 'projects:list',
  projectOpen: 'projects:open',
  projectRemove: 'projects:remove',
  projectPin: 'projects:pin',
  projectInspect: 'projects:inspect',
  projectAdditionalDir: 'projects:add-directory',
  attachmentsPick: 'attachments:pick',
  sessionsList: 'sessions:list',
  sessionCreate: 'sessions:create',
  sessionResume: 'sessions:resume',
  sessionSnapshot: 'sessions:snapshot',
  sessionPrompt: 'sessions:prompt',
  sessionSteer: 'sessions:steer',
  sessionCancel: 'sessions:cancel',
  sessionArchive: 'sessions:archive',
  sessionPin: 'sessions:pin',
  sessionRename: 'sessions:rename',
  sessionFork: 'sessions:fork',
  sessionConfigure: 'sessions:configure',
  sessionClose: 'sessions:close',
  approvalResolve: 'reverse-rpc:approval',
  questionResolve: 'reverse-rpc:question',
  authStatus: 'auth:status',
  authLogin: 'auth:login',
  authLogout: 'auth:logout',
  modelsGet: 'models:get',
  modelsConfigureDefault: 'models:configure-default',
  modelsCatalogList: 'models:catalog-list',
  modelsCatalogAdd: 'models:catalog-add',
  gitStatus: 'git:status',
  gitDiff: 'git:diff',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitRevert: 'git:revert',
  gitCommit: 'git:commit',
  gitPush: 'git:push',
  gitBranches: 'git:branches',
  gitPullRequests: 'git:pull-requests',
  gitPullRequestDetail: 'git:pull-request-detail',
  gitPullRequestCreate: 'git:pull-request-create',
  gitWorktrees: 'git:worktrees',
  worktreeCreate: 'worktree:create',
  worktreeRemove: 'worktree:remove',
  worktreeHandoff: 'worktree:handoff',
  filesList: 'files:list',
  filesSearch: 'files:search',
  fileRead: 'files:read',
  fileWrite: 'files:write',
  fileReveal: 'files:reveal',
  fileOpenExternal: 'files:open-external',
  terminalCreate: 'terminal:create',
  terminalInput: 'terminal:input',
  terminalResize: 'terminal:resize',
  terminalClose: 'terminal:close',
  browserCreate: 'browser:create',
  browserNavigate: 'browser:navigate',
  browserAction: 'browser:action',
  browserBounds: 'browser:bounds',
  browserHide: 'browser:hide',
  browserClose: 'browser:close',
  browserScreenshot: 'browser:screenshot',
  browserAnnotate: 'browser:annotate',
  pluginsList: 'plugins:list',
  pluginInstall: 'plugins:install',
  pluginEnable: 'plugins:enable',
  pluginMcpEnable: 'plugins:mcp-enable',
  pluginRemove: 'plugins:remove',
  pluginCommandsList: 'plugins:commands-list',
  pluginCommandActivate: 'plugins:command-activate',
  skillsList: 'skills:list',
  skillActivate: 'skills:activate',
  mcpList: 'mcp:list',
  mcpReconnect: 'mcp:reconnect',
  backgroundTasksList: 'background-tasks:list',
  backgroundTaskOutput: 'background-tasks:output',
  backgroundTaskStop: 'background-tasks:stop',
  automationsList: 'automations:list',
  automationSave: 'automations:save',
  automationDelete: 'automations:delete',
  automationRun: 'automations:run',
  inboxList: 'inbox:list',
  inboxRead: 'inbox:read',
  memoriesSearch: 'memories:search',
  memorySave: 'memories:save',
  memoryDelete: 'memories:delete',
  sitesList: 'sites:list',
  siteSave: 'sites:save',
  siteServe: 'sites:serve',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  event: 'event:session',
  approval: 'event:approval',
  question: 'event:question',
  terminalData: 'event:terminal-data',
  terminalExit: 'event:terminal-exit',
  browserState: 'event:browser-state',
  automationState: 'event:automation-state',
} as const;

export type PermissionMode = 'manual' | 'auto' | 'yolo';
export type ExecutionTarget = 'local' | 'worktree' | 'ssh';
export type InteractionMode = 'agent' | 'plan' | 'debug' | 'multitask' | 'ask';

export const INTERACTION_MODE_LABELS: Readonly<Record<InteractionMode, string>> = {
  agent: '助理',
  plan: '计划',
  debug: '排障',
  multitask: '集群',
  ask: '聊天',
};

export function resolveInteractionMode(input: {
  readonly interactionMode?: InteractionMode;
  readonly planMode?: boolean;
  readonly swarmMode?: boolean;
  readonly askMode?: boolean;
  readonly debugMode?: boolean;
}): InteractionMode {
  if (input.interactionMode !== undefined) return input.interactionMode;
  if (input.askMode === true) return 'ask';
  if (input.debugMode === true) return 'debug';
  if (input.planMode === true) return 'plan';
  if (input.swarmMode === true) return 'multitask';
  return 'agent';
}

export type ShellStyle = 'macos-vibrancy' | 'opaque';

export interface BootstrapInfo {
  readonly appName: string;
  readonly displayName: string;
  readonly version: string;
  readonly platform: NodeJS.Platform;
  readonly shellStyle: ShellStyle;
  readonly userName: string;
  readonly homeDir: string;
  readonly configPath: string;
  readonly logDir: string;
  readonly logFile: string;
  readonly defaultModel?: string;
  readonly defaultThinking?: string;
  readonly models: readonly ModelOption[];
  readonly settings: AppSettings;
}

export interface ModelOption {
  readonly id: string;
  readonly label: string;
  readonly provider: string;
  readonly thinkingEfforts: readonly string[];
  readonly defaultThinking: string;
  readonly thinkingRequired: boolean;
}

export interface ModelConfiguration {
  readonly defaultModel?: string;
  readonly defaultThinking?: string;
  readonly models: readonly ModelOption[];
}

export interface DefaultModelConfigurationRequest {
  readonly model: string;
  readonly thinking: string;
}

export interface CatalogProviderOption {
  readonly id: string;
  readonly label: string;
  readonly baseUrl?: string;
  readonly env: readonly string[];
  readonly models: readonly ModelOption[];
}

export interface AddCatalogProviderRequest extends DefaultModelConfigurationRequest {
  readonly providerId: string;
  readonly apiKey: string;
}

export interface AuthProviderStatus {
  readonly providerName: string;
  readonly hasToken: boolean;
}

export interface AuthStatus {
  readonly providers: readonly AuthProviderStatus[];
}

export interface AppSettings {
  readonly locale: 'zh-CN' | 'en-US';
  readonly theme: 'dark' | 'light' | 'system';
  readonly accent: string;
  readonly uiFont: string;
  readonly codeFont: string;
  readonly terminalFontSize: number;
  readonly editorCommand?: string;
  readonly terminalShell?: string;
  readonly notifications: boolean;
  readonly followUp: 'steer' | 'queue';
  readonly worktreeRoot: string;
  readonly worktreeRetention: number;
  readonly memoryEnabled: boolean;
  readonly browserAllowlist: readonly string[];
  readonly browserBlocklist: readonly string[];
  readonly computerAllowlist: readonly string[];
  readonly sshProfiles: readonly SshProfile[];
  readonly logLevel: LogLevel;
  readonly logMirrorConsole: boolean;
  readonly logIpcTrace: boolean;
}

export interface SshProfile {
  readonly id: string;
  readonly label: string;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly remotePath: string;
  readonly keyPaths: readonly string[];
  readonly hostKeySha256?: string;
  readonly trustUnknownHost: boolean;
}

export interface ProjectSummary {
  readonly workDir: string;
  readonly name: string;
  readonly branch?: string;
  readonly remote?: string;
  readonly lastPrompt?: string;
  readonly updatedAt: number;
  readonly sessionCount: number;
  readonly pinned: boolean;
  readonly additionalDirs: readonly string[];
}

export interface TaskSummary {
  readonly id: string;
  readonly title: string;
  readonly lastPrompt?: string;
  readonly workDir: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly archived: boolean;
  readonly pinned: boolean;
  readonly unread: boolean;
  readonly target: ExecutionTarget;
}

export interface SessionSnapshot {
  readonly id: string;
  readonly workDir: string;
  readonly title: string;
  readonly status: SessionStatusView;
  readonly replay: readonly unknown[];
  readonly liveEvents: readonly EventEnvelope[];
  readonly additionalDirs: readonly string[];
}

export interface SessionStatusView {
  readonly running: boolean;
  readonly model?: string;
  readonly thinkingEffort?: string;
  readonly permission: PermissionMode;
  readonly interactionMode: InteractionMode;
  readonly planMode: boolean;
  readonly swarmMode: boolean;
  readonly askMode: boolean;
  readonly debugMode: boolean;
  readonly contextTokens: number;
  readonly maxContextTokens: number;
}

export interface PromptAttachment {
  readonly kind: 'image' | 'video' | 'file';
  readonly name: string;
  readonly path: string;
  readonly dataUrl?: string;
  readonly browserAnnotation?: BrowserAnnotation;
}

export interface PathSuggestion {
  readonly root: string;
  readonly path: string;
  readonly name: string;
  readonly kind: 'file' | 'directory';
}

export type PromptReference =
  | {
      readonly kind: 'path';
      readonly root: string;
      readonly path: string;
      readonly name: string;
      readonly pathKind: 'file' | 'directory';
    }
  | {
      readonly kind: 'skill';
      readonly name: string;
    }
  | {
      readonly kind: 'session';
      readonly sessionId: string;
      readonly title: string;
    };

export interface CreateSessionRequest {
  readonly workDir: string;
  readonly model?: string;
  readonly thinking?: string;
  readonly permission?: PermissionMode;
  readonly interactionMode?: InteractionMode;
  readonly planMode?: boolean;
  readonly target?: ExecutionTarget;
  readonly branch?: string;
  readonly additionalDirs?: readonly string[];
  readonly sshProfileId?: string;
}

export interface PromptRequest {
  readonly sessionId: string;
  readonly text: string;
  readonly attachments?: readonly PromptAttachment[];
  readonly references?: readonly PromptReference[];
}

export interface SessionConfiguration {
  readonly model?: string;
  readonly thinking?: string;
  readonly permission?: PermissionMode;
  readonly interactionMode?: InteractionMode;
  readonly planMode?: boolean;
  readonly swarmMode?: boolean;
}

export interface EventEnvelope {
  readonly seq: number;
  readonly sessionId: string;
  readonly event: Readonly<Record<string, unknown>>;
}

export interface PendingApproval {
  readonly id: string;
  readonly sessionId: string;
  readonly toolName: string;
  readonly action: string;
  readonly description?: string;
  readonly display?: unknown;
  readonly options?: readonly string[];
}

export interface ApprovalResolution {
  readonly id: string;
  readonly decision: 'approved' | 'rejected' | 'cancelled';
  readonly scope?: 'once' | 'session';
  readonly feedback?: string;
  readonly selectedLabel?: string;
}

export interface PendingQuestion {
  readonly id: string;
  readonly sessionId: string;
  readonly questions: readonly QuestionView[];
}

export interface QuestionView {
  readonly id: string;
  readonly header?: string;
  readonly prompt: string;
  readonly options: readonly { readonly label: string; readonly description?: string }[];
  readonly multiple: boolean;
}

export interface QuestionResolution {
  readonly id: string;
  readonly answers: Readonly<Record<string, readonly string[]>>;
  readonly cancelled?: boolean;
}

export interface GitStatus {
  readonly branch: string;
  readonly upstream?: string;
  readonly ahead: number;
  readonly behind: number;
  readonly files: readonly GitFileStatus[];
  readonly clean: boolean;
}

export interface GitFileStatus {
  readonly path: string;
  readonly index: string;
  readonly worktree: string;
  readonly originalPath?: string;
}

export interface GitDiff {
  readonly text: string;
  readonly staged: boolean;
  readonly file?: string;
}

export interface PullRequestSummary {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly url: string;
  readonly headRefName: string;
  readonly baseRefName: string;
  readonly author: string;
  readonly reviewDecision?: string;
  readonly checks?: string;
}

export interface PullRequestDetail extends PullRequestSummary {
  readonly body: string;
  readonly comments: readonly { readonly author: string; readonly body: string; readonly url?: string }[];
  readonly reviews: readonly { readonly author: string; readonly state: string; readonly body?: string }[];
  readonly files: readonly { readonly path: string; readonly additions: number; readonly deletions: number }[];
}

export interface WorktreeSummary {
  readonly path: string;
  readonly head: string;
  readonly branch?: string;
  readonly bare: boolean;
  readonly detached: boolean;
  readonly locked?: string;
}

export interface FileEntry {
  readonly name: string;
  readonly path: string;
  readonly kind: 'file' | 'directory' | 'symlink';
  readonly size: number;
  readonly modifiedAt: number;
  readonly children?: readonly FileEntry[];
}

export interface FileContent {
  readonly path: string;
  readonly name: string;
  readonly kind: 'text' | 'image' | 'pdf' | 'binary';
  readonly content?: string;
  readonly dataUrl?: string;
  readonly mime?: string;
  readonly modifiedAt: number;
}

export interface TerminalInfo {
  readonly id: string;
  readonly sessionId?: string;
  readonly title: string;
  readonly cwd: string;
}

export interface TerminalDataEvent {
  readonly id: string;
  readonly data: string;
}

export interface BrowserTab {
  readonly id: string;
  readonly sessionId?: string;
  readonly url: string;
  readonly title: string;
  readonly loading: boolean;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly zoomFactor: number;
  readonly autoFit: boolean;
  readonly devToolsOpen: boolean;
}

export type BrowserAction =
  | 'back'
  | 'forward'
  | 'reload'
  | 'stop'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'fit'
  | 'devtools';

export interface BrowserAnnotation {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly selector: string;
  readonly tag: string;
  readonly text: string;
  readonly html: string;
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly screenshot: string;
}

export interface PluginView {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly enabled: boolean;
  readonly state: string;
  readonly hasErrors: boolean;
  readonly source?: string;
  readonly skillCount: number;
  readonly mcpServerCount: number;
  readonly enabledMcpServerCount: number;
  readonly hookCount: number;
  readonly commandCount: number;
  readonly diagnostics: readonly PluginDiagnosticView[];
  readonly mcpServers: readonly PluginMcpServerView[];
}

export interface PluginDiagnosticView {
  readonly severity: string;
  readonly message: string;
}

export interface PluginMcpServerView {
  readonly name: string;
  readonly enabled: boolean;
  readonly transport: string;
}

export interface PluginCommandView {
  readonly pluginId: string;
  readonly name: string;
  readonly description: string;
}

export interface SkillView {
  readonly name: string;
  readonly description?: string;
  readonly path?: string;
  readonly source?: string;
  readonly type?: string;
  readonly disableModelInvocation: boolean;
  readonly isSubSkill: boolean;
  readonly userActivatable: boolean;
}

export interface McpServerView {
  readonly name: string;
  readonly status: string;
  readonly transport?: string;
  readonly toolCount: number;
  readonly error?: string;
}

export type BackgroundTaskStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'killed'
  | 'lost';

export interface BackgroundTaskView {
  readonly taskId: string;
  readonly kind: 'process' | 'agent' | 'question';
  readonly description: string;
  readonly status: BackgroundTaskStatus;
  readonly detached: boolean;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly stopReason?: string;
  readonly agentId?: string;
  readonly subagentType?: string;
  readonly command?: string;
}

export interface Automation {
  readonly id: string;
  readonly name: string;
  readonly prompt: string;
  readonly projectPath: string;
  readonly sessionId?: string;
  readonly schedule: string;
  readonly nextRunAt: number;
  readonly enabled: boolean;
  readonly mode: 'new-task' | 'same-task';
  readonly target: 'local' | 'worktree';
  readonly model?: string;
  readonly createdAt: number;
  readonly lastRunAt?: number;
}

export interface InboxItem {
  readonly id: string;
  readonly automationId?: string;
  readonly sessionId?: string;
  readonly title: string;
  readonly detail: string;
  readonly status: 'success' | 'failed' | 'attention';
  readonly unread: boolean;
  readonly createdAt: number;
}

export interface MemoryRecord {
  readonly id: string;
  readonly projectPath?: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface SiteRecord {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly url?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface DesktopApi {
  bootstrap(): Promise<BootstrapInfo>;
  openExternal(url: string): Promise<void>;
  setAlwaysOnTop(enabled: boolean): Promise<void>;
  notify(title: string, body: string): Promise<void>;
  listProjects(): Promise<readonly ProjectSummary[]>;
  openProject(): Promise<ProjectSummary | undefined>;
  removeProject(workDir: string): Promise<void>;
  setProjectPinned(workDir: string, pinned: boolean): Promise<ProjectSummary>;
  inspectProject(workDir: string): Promise<ProjectSummary>;
  addProjectDirectory(workDir: string, sessionId?: string): Promise<readonly string[]>;
  pickAttachments(): Promise<readonly PromptAttachment[]>;
  listSessions(workDir?: string, includeArchived?: boolean): Promise<readonly TaskSummary[]>;
  createSession(input: CreateSessionRequest): Promise<SessionSnapshot>;
  resumeSession(sessionId: string): Promise<SessionSnapshot>;
  sessionSnapshot(sessionId: string): Promise<SessionSnapshot>;
  prompt(input: PromptRequest): Promise<void>;
  steer(input: PromptRequest): Promise<void>;
  cancelSession(sessionId: string): Promise<void>;
  archiveSession(sessionId: string): Promise<void>;
  pinSession(sessionId: string, pinned: boolean): Promise<void>;
  renameSession(sessionId: string, title: string): Promise<void>;
  forkSession(sessionId: string, workDir?: string): Promise<SessionSnapshot>;
  configureSession(sessionId: string, config: SessionConfiguration): Promise<SessionStatusView>;
  closeSession(sessionId: string): Promise<void>;
  resolveApproval(input: ApprovalResolution): Promise<void>;
  resolveQuestion(input: QuestionResolution): Promise<void>;
  authStatus(): Promise<AuthStatus>;
  authLogin(): Promise<unknown>;
  authLogout(): Promise<unknown>;
  modelConfiguration(): Promise<ModelConfiguration>;
  configureDefaultModel(input: DefaultModelConfigurationRequest): Promise<ModelConfiguration>;
  listModelCatalog(): Promise<readonly CatalogProviderOption[]>;
  addCatalogProvider(input: AddCatalogProviderRequest): Promise<ModelConfiguration>;
  gitStatus(workDir: string): Promise<GitStatus>;
  gitDiff(workDir: string, staged?: boolean, file?: string): Promise<GitDiff>;
  gitStage(workDir: string, paths: readonly string[]): Promise<void>;
  gitUnstage(workDir: string, paths: readonly string[]): Promise<void>;
  gitRevert(workDir: string, paths: readonly string[]): Promise<void>;
  gitCommit(workDir: string, message: string): Promise<string>;
  gitPush(workDir: string): Promise<string>;
  gitBranches(workDir: string): Promise<readonly string[]>;
  pullRequests(workDir: string): Promise<readonly PullRequestSummary[]>;
  pullRequestDetail(workDir: string, number: number): Promise<PullRequestDetail>;
  createPullRequest(workDir: string, title: string, body: string): Promise<string>;
  worktrees(workDir: string): Promise<readonly WorktreeSummary[]>;
  createWorktree(workDir: string, branch?: string, includeChanges?: boolean): Promise<WorktreeSummary>;
  removeWorktree(workDir: string, path: string): Promise<void>;
  handoffWorktree(source: string, target: string): Promise<void>;
  listFiles(root: string): Promise<readonly FileEntry[]>;
  searchWorkspacePaths(root: string, query: string): Promise<readonly PathSuggestion[]>;
  readFile(root: string, path: string): Promise<FileContent>;
  writeFile(root: string, path: string, content: string): Promise<void>;
  revealFile(path: string): Promise<void>;
  openFileExternal(path: string): Promise<void>;
  createTerminal(cwd: string, sessionId?: string): Promise<TerminalInfo>;
  terminalInput(id: string, data: string): Promise<void>;
  terminalResize(id: string, cols: number, rows: number): Promise<void>;
  closeTerminal(id: string): Promise<void>;
  createBrowser(sessionId?: string, url?: string): Promise<BrowserTab>;
  browserNavigate(id: string, url: string): Promise<void>;
  browserAction(id: string, action: BrowserAction): Promise<void>;
  browserBounds(id: string, bounds: { x: number; y: number; width: number; height: number }): Promise<void>;
  hideBrowser(id: string): Promise<void>;
  closeBrowser(id: string): Promise<void>;
  browserScreenshot(id: string): Promise<string>;
  browserAnnotate(id: string): Promise<BrowserAnnotation | undefined>;
  listPlugins(sessionId?: string): Promise<readonly PluginView[]>;
  installPlugin(source: string, sessionId?: string): Promise<void>;
  enablePlugin(id: string, enabled: boolean, sessionId?: string): Promise<void>;
  enablePluginMcp(id: string, server: string, enabled: boolean, sessionId?: string): Promise<void>;
  removePlugin(id: string, sessionId?: string): Promise<void>;
  listPluginCommands(sessionId: string): Promise<readonly PluginCommandView[]>;
  activatePluginCommand(sessionId: string, pluginId: string, commandName: string, args?: string): Promise<void>;
  listSkills(sessionId?: string, workDir?: string): Promise<readonly SkillView[]>;
  activateSkill(sessionId: string, name: string, args?: string): Promise<void>;
  listMcp(sessionId: string): Promise<readonly McpServerView[]>;
  reconnectMcp(sessionId: string, name: string): Promise<void>;
  listBackgroundTasks(sessionId: string): Promise<readonly BackgroundTaskView[]>;
  getBackgroundTaskOutput(sessionId: string, taskId: string, tail?: number): Promise<string>;
  stopBackgroundTask(sessionId: string, taskId: string): Promise<void>;
  listAutomations(): Promise<readonly Automation[]>;
  saveAutomation(input: Omit<Automation, 'id' | 'createdAt'> & { readonly id?: string }): Promise<Automation>;
  deleteAutomation(id: string): Promise<void>;
  runAutomation(id: string): Promise<void>;
  listInbox(): Promise<readonly InboxItem[]>;
  markInboxRead(id: string): Promise<void>;
  searchMemories(query: string, projectPath?: string): Promise<readonly MemoryRecord[]>;
  saveMemory(input: Pick<MemoryRecord, 'content' | 'projectPath' | 'tags'> & { readonly id?: string }): Promise<MemoryRecord>;
  deleteMemory(id: string): Promise<void>;
  listSites(): Promise<readonly SiteRecord[]>;
  saveSite(input: Omit<SiteRecord, 'id' | 'createdAt' | 'updatedAt'> & { readonly id?: string }): Promise<SiteRecord>;
  serveSite(id: string, lan?: boolean): Promise<SiteRecord>;
  getSettings(): Promise<AppSettings>;
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  revealLogs(): Promise<void>;
  onSessionEvent(listener: (event: EventEnvelope) => void): () => void;
  onApproval(listener: (request: PendingApproval) => void): () => void;
  onQuestion(listener: (request: PendingQuestion) => void): () => void;
  onTerminalData(listener: (event: TerminalDataEvent) => void): () => void;
  onTerminalExit(listener: (event: { readonly id: string; readonly exitCode: number }) => void): () => void;
  onBrowserState(listener: (tab: BrowserTab) => void): () => void;
  onAutomationState(listener: () => void): () => void;
  onNavigate(listener: (route: string) => void): () => void;
  onOpenProjectRequest(listener: () => void): () => void;
}
