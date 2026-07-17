import type { LogLevel } from './logging';
import type { TodoItem } from './todo';

export type { LogLevel } from './logging';
export type { TodoItem, TodoStatus } from './todo';

export const IPC = {
  bootstrap: 'app:bootstrap',
  openExternal: 'app:open-external',
  openSettings: 'app:open-settings',
  setAlwaysOnTop: 'app:set-always-on-top',
  notify: 'app:notify',
  logsReveal: 'logs:reveal',
  projectsList: 'projects:list',
  projectsListHidden: 'projects:list-hidden',
  projectOpen: 'projects:open',
  projectRemove: 'projects:remove',
  projectRestore: 'projects:restore',
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
  sessionCompact: 'sessions:compact',
  sessionInit: 'sessions:init',
  sessionUsage: 'sessions:usage',
  sessionClearPlan: 'sessions:clear-plan',
  sessionClose: 'sessions:close',
  plansList: 'plans:list',
  planRead: 'plans:read',
  planPatchTodos: 'plans:patch-todos',
  approvalResolve: 'reverse-rpc:approval',
  questionResolve: 'reverse-rpc:question',
  debugVerificationResolve: 'reverse-rpc:debug-verification',
  authStatus: 'auth:status',
  authLogin: 'auth:login',
  authLogout: 'auth:logout',
  modelsGet: 'models:get',
  modelsConfigureDefault: 'models:configure-default',
  modelsCatalogList: 'models:catalog-list',
  modelsCatalogAdd: 'models:catalog-add',
  billingDeepSeekSnapshot: 'billing:deepseek-snapshot',
  contextUsageSnapshot: 'context:usage-snapshot',
  gitStatus: 'git:status',
  gitDiff: 'git:diff',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitRevert: 'git:revert',
  gitCommit: 'git:commit',
  gitPush: 'git:push',
  gitFetch: 'git:fetch',
  gitPull: 'git:pull',
  gitCheckout: 'git:checkout',
  gitCreateBranch: 'git:create-branch',
  gitInit: 'git:init',
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
  filePreview: 'files:preview',
  fileOpenInEditor: 'files:open-in-editor',
  fileOpenInTerminal: 'files:open-in-terminal',
  editorsList: 'editors:list',
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
  inboxDelete: 'inbox:delete',
  inboxMarkAllRead: 'inbox:mark-all-read',
  inboxUnreadCount: 'inbox:unread-count',
  memoriesSearch: 'memories:search',
  memorySave: 'memories:save',
  memoryDelete: 'memories:delete',
  sitesList: 'sites:list',
  siteSave: 'sites:save',
  siteServe: 'sites:serve',
  siteStop: 'sites:stop',
  siteDelete: 'sites:delete',
  sitePickDirectory: 'sites:pick-directory',
  pluginsMarketplace: 'plugins:marketplace',
  indexStatus: 'index:status',
  indexAssess: 'index:assess',
  indexActivate: 'index:activate',
  indexCancel: 'index:cancel',
  indexDeactivate: 'index:deactivate',
  indexRebuild: 'index:rebuild',
  indexSearch: 'index:search',
  indexContextPreview: 'index:context-preview',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  event: 'event:session',
  approval: 'event:approval',
  question: 'event:question',
  debugVerification: 'event:debug-verification',
  terminalData: 'event:terminal-data',
  terminalExit: 'event:terminal-exit',
  browserState: 'event:browser-state',
  automationState: 'event:automation-state',
  inboxState: 'event:inbox-state',
} as const;

export type PermissionMode = 'manual' | 'auto' | 'yolo';
export type ExecutionTarget = 'local' | 'worktree' | 'ssh';
export type InteractionMode = 'agent' | 'plan' | 'debug' | 'multitask' | 'ask' | 'engineering';

export const INTERACTION_MODE_LABELS: Readonly<Record<InteractionMode, string>> = {
  agent: '助理',
  plan: '计划',
  debug: '排障',
  multitask: '集群',
  ask: '聊天',
  engineering: '工程',
};

export function resolveInteractionMode(input: {
  readonly interactionMode?: InteractionMode;
  readonly planMode?: boolean;
  readonly swarmMode?: boolean;
  readonly askMode?: boolean;
  readonly debugMode?: boolean;
  readonly engineeringMode?: boolean;
}): InteractionMode {
  if (input.interactionMode !== undefined) return input.interactionMode;
  if (input.askMode === true) return 'ask';
  if (input.debugMode === true) return 'debug';
  if (input.planMode === true) return 'plan';
  if (input.swarmMode === true) return 'multitask';
  if (input.engineeringMode === true) return 'engineering';
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

export interface DeepSeekRateView {
  readonly hit: number;
  readonly miss: number;
  readonly out: number;
}

export interface DeepSeekBillingSnapshot {
  readonly enabled: boolean;
  readonly balanceCny: string | null;
  readonly grantedCny: string | null;
  readonly toppedUpCny: string | null;
  readonly balanceAvailable: boolean;
  readonly balanceError?: string;
  readonly balanceFetchedAtMs: number | null;
  readonly sessionInput: number;
  readonly sessionOutput: number;
  readonly sessionCacheHit: number;
  readonly sessionCacheMiss: number;
  readonly sessionCacheHitPct: number | null;
  readonly estimatedCostCny: number;
  readonly isPeakNow: boolean;
  readonly modelId: string | null;
  readonly rates: DeepSeekRateView | null;
  readonly peakRates: DeepSeekRateView | null;
  readonly pricingSource: 'embedded';
}

export interface DeepSeekBillingSnapshotRequest {
  readonly sessionId?: string;
  readonly refreshBalance?: boolean;
}

export interface ContextUsageCategoriesView {
  readonly systemPrompt: number;
  readonly toolDefinitions: number;
  readonly rules: number;
  readonly skills: number;
  readonly subagentDefinitions: number;
  readonly conversation: number;
}

export interface ContextUsageSnapshot {
  readonly contextTokens: number;
  readonly maxContextTokens: number;
  readonly categories: ContextUsageCategoriesView;
}

export interface ContextUsageSnapshotRequest {
  readonly sessionId: string;
}

export interface AppSettings {
  readonly locale: 'zh-CN' | 'en-US';
  readonly theme: 'dark' | 'light' | 'system';
  readonly accentDark: string;
  readonly accentLight: string;
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
  readonly indexEnabled: boolean;
  readonly indexSemanticEnabled: boolean;
  readonly indexMaxFileBytes: number;
  readonly indexOptOutRoots: readonly string[];
  readonly browserAllowlist: readonly string[];
  readonly browserBlocklist: readonly string[];
  readonly computerAllowlist: readonly string[];
  readonly sshProfiles: readonly SshProfile[];
  readonly logLevel: LogLevel;
  readonly logMirrorConsole: boolean;
  readonly logIpcTrace: boolean;
}

export type IndexState = 'idle' | 'indexing' | 'ready' | 'error' | 'disabled' | 'blocked';
export type IndexSearchMode = 'hybrid' | 'semantic' | 'lexical';
export type IndexRiskKind = 'none' | 'home' | 'large';

export interface IndexRiskAssessment {
  readonly root: string;
  readonly kind: IndexRiskKind;
  readonly estimatedFiles?: number;
  readonly message: string;
}

export interface IndexActivateOptions {
  readonly force?: boolean;
}

export interface IndexStatus {
  readonly workDir: string;
  readonly state: IndexState;
  readonly progress: number;
  readonly fileCount: number;
  readonly chunkCount: number;
  readonly embeddedCount: number;
  readonly semanticReady: boolean;
  readonly embedderId: string;
  readonly lastSyncedAt?: number;
  readonly error?: string;
  readonly truncated?: boolean;
  readonly risk?: IndexRiskKind;
}

export interface IndexSearchRequest {
  readonly workDir: string;
  readonly query: string;
  readonly additionalDirs?: readonly string[];
  readonly mode?: IndexSearchMode;
  readonly limit?: number;
}

export interface IndexSearchHit {
  readonly root: string;
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly snippet: string;
  readonly score: number;
  readonly source: 'lexical' | 'semantic' | 'hybrid';
}

export interface IndexContextPreviewEntry {
  readonly query: string;
  readonly chars: number;
  readonly hitCount: number;
}

export interface IndexContextPreview {
  readonly totalChars: number;
  readonly maxChars: number;
  readonly entries: readonly IndexContextPreviewEntry[];
}

export interface IndexContextPreviewRequest {
  readonly workDir: string;
  readonly additionalDirs?: readonly string[];
  readonly references: readonly PromptReference[];
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
  readonly isGitRepository: boolean;
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
  /** Current TodoList tool-store items for the main agent, when available. */
  readonly todos?: readonly TodoItem[];
}

export interface SessionStatusView {
  readonly running: boolean;
  readonly model?: string;
  readonly thinkingEffort?: string;
  readonly permission: PermissionMode;
  readonly interactionMode: InteractionMode;
  readonly planMode: boolean;
  /** Active plan file while Plan mode is on. */
  readonly planFilePath?: string;
  /** Plan file bound after Build approval (persists after exiting Plan mode). */
  readonly approvedPlanPath?: string;
  readonly swarmMode: boolean;
  readonly askMode: boolean;
  readonly debugMode: boolean;
  readonly engineeringMode: boolean;
  readonly contextTokens: number;
  readonly maxContextTokens: number;
}

export interface PatchPlanTodosRequest {
  readonly sessionId: string;
  readonly path: string;
  readonly todos: readonly {
    readonly id: string;
    readonly content: string;
    readonly status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  }[];
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
    }
  | {
      readonly kind: 'codebase';
      readonly query: string;
      readonly limit?: number;
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

export interface SessionTokenUsage {
  readonly inputOther: number;
  readonly output: number;
  readonly inputCacheRead: number;
  readonly inputCacheCreation: number;
}

export interface SessionUsageView {
  readonly byModel?: Record<string, SessionTokenUsage>;
  readonly currentTurn?: SessionTokenUsage;
  readonly total?: SessionTokenUsage;
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
  readonly toolCallId?: string;
}

export type ProjectPlanKind = 'spec' | 'implementation';

export interface ProjectPlanSummary {
  readonly id: string;
  readonly path: string;
  readonly fileName: string;
  readonly sessionId: string;
  readonly sessionTitle: string;
  readonly updatedAt: number;
  readonly title: string;
  readonly kind: ProjectPlanKind;
}

export interface ReadPlanFileRequest {
  readonly path: string;
  readonly workDir?: string;
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
  readonly otherLabel?: string;
  readonly otherDescription?: string;
}

export interface QuestionResolution {
  readonly id: string;
  readonly answers: Readonly<Record<string, readonly string[]>>;
  readonly cancelled?: boolean;
}

export interface DebugProbe {
  readonly id: string;
  readonly file: string;
  readonly line?: number;
  readonly label: string;
  readonly marker: string;
}

export interface PendingDebugVerification {
  readonly id: string;
  readonly sessionId: string;
  readonly steps: readonly string[];
  readonly hypothesis?: string;
  readonly probes: readonly DebugProbe[];
}

export interface DebugVerificationResolution {
  readonly id: string;
  readonly outcome: 'fixed' | 'not_fixed' | 'cancelled';
  readonly userNotes?: string;
}

export interface GitLineStats {
  readonly additions: number;
  readonly deletions: number;
}

export interface GitStatusLineStats {
  readonly total: GitLineStats;
  readonly staged: GitLineStats;
  readonly unstaged: GitLineStats;
}

export interface GitStatus {
  readonly branch: string;
  readonly upstream?: string;
  readonly ahead: number;
  readonly behind: number;
  readonly files: readonly GitFileStatus[];
  readonly clean: boolean;
  readonly lineStats?: GitStatusLineStats;
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
  readonly truncated?: boolean;
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

export interface EditorPresetView {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly iconDataUrl?: string;
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

export type PluginMarketplaceTier = 'official' | 'curated';

export type PluginMarketplaceUpdateStatus =
  | { readonly kind: 'not-installed' }
  | { readonly kind: 'up-to-date'; readonly version?: string }
  | { readonly kind: 'update'; readonly local: string; readonly latest: string };

export interface PluginMarketplaceEntryView {
  readonly id: string;
  readonly displayName: string;
  readonly source: string;
  readonly tier?: PluginMarketplaceTier;
  readonly version?: string;
  readonly description?: string;
  readonly homepage?: string;
  readonly keywords?: readonly string[];
  readonly updateStatus: PluginMarketplaceUpdateStatus;
  readonly installed: boolean;
}

export interface PluginMarketplaceView {
  readonly source: string;
  readonly version?: string;
  readonly plugins: readonly PluginMarketplaceEntryView[];
}

export interface ActivateSkillResult {
  readonly sessionId: string;
}

export interface ActivatePluginCommandResult {
  readonly sessionId: string;
}

export interface DesktopApi {
  bootstrap(): Promise<BootstrapInfo>;
  openExternal(url: string): Promise<void>;
  setAlwaysOnTop(enabled: boolean): Promise<void>;
  notify(title: string, body: string): Promise<void>;
  listProjects(): Promise<readonly ProjectSummary[]>;
  listHiddenProjects(): Promise<readonly ProjectSummary[]>;
  openProject(): Promise<ProjectSummary | undefined>;
  removeProject(workDir: string): Promise<void>;
  restoreProject(workDir: string): Promise<ProjectSummary>;
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
  compactSession(sessionId: string, instruction?: string): Promise<void>;
  initSession(sessionId: string): Promise<void>;
  getSessionUsage(sessionId: string): Promise<SessionUsageView>;
  clearSessionPlan(sessionId: string): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
  listProjectPlans(workDir: string): Promise<readonly ProjectPlanSummary[]>;
  readPlanFile(input: ReadPlanFileRequest): Promise<string>;
  patchPlanTodos(input: PatchPlanTodosRequest): Promise<string>;
  resolveApproval(input: ApprovalResolution): Promise<void>;
  resolveQuestion(input: QuestionResolution): Promise<void>;
  resolveDebugVerification(input: DebugVerificationResolution): Promise<void>;
  authStatus(): Promise<AuthStatus>;
  authLogin(): Promise<unknown>;
  authLogout(): Promise<unknown>;
  modelConfiguration(): Promise<ModelConfiguration>;
  configureDefaultModel(input: DefaultModelConfigurationRequest): Promise<ModelConfiguration>;
  listModelCatalog(): Promise<readonly CatalogProviderOption[]>;
  addCatalogProvider(input: AddCatalogProviderRequest): Promise<ModelConfiguration>;
  deepSeekBillingSnapshot(input?: DeepSeekBillingSnapshotRequest): Promise<DeepSeekBillingSnapshot>;
  contextUsageSnapshot(input: ContextUsageSnapshotRequest): Promise<ContextUsageSnapshot>;
  gitStatus(workDir: string): Promise<GitStatus>;
  gitDiff(workDir: string, staged?: boolean, file?: string): Promise<GitDiff>;
  gitStage(workDir: string, paths: readonly string[]): Promise<void>;
  gitUnstage(workDir: string, paths: readonly string[]): Promise<void>;
  gitRevert(workDir: string, paths: readonly string[]): Promise<void>;
  gitCommit(workDir: string, message: string): Promise<string>;
  gitPush(workDir: string): Promise<string>;
  gitFetch(workDir: string): Promise<string>;
  gitPull(workDir: string): Promise<string>;
  gitCheckout(workDir: string, branch: string): Promise<void>;
  gitCreateBranch(workDir: string, name: string): Promise<void>;
  gitInit(workDir: string): Promise<ProjectSummary>;
  gitBranches(workDir: string): Promise<readonly string[]>;
  pullRequests(
    workDir: string,
    state?: 'open' | 'closed' | 'merged' | 'all',
  ): Promise<readonly PullRequestSummary[]>;
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
  previewWorkspaceFile(workDir: string, relativePath: string): Promise<string>;
  openInEditor(path: string, command?: string): Promise<void>;
  openInTerminal(path: string): Promise<void>;
  listAvailableEditors(): Promise<readonly EditorPresetView[]>;
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
  listPluginCommands(sessionId?: string): Promise<readonly PluginCommandView[]>;
  activatePluginCommand(
    sessionId: string | undefined,
    pluginId: string,
    commandName: string,
    args?: string,
    workDir?: string,
  ): Promise<ActivatePluginCommandResult>;
  listSkills(sessionId?: string, workDir?: string): Promise<readonly SkillView[]>;
  activateSkill(
    sessionId: string | undefined,
    name: string,
    args?: string,
    workDir?: string,
  ): Promise<ActivateSkillResult>;
  listMcp(sessionId?: string): Promise<readonly McpServerView[]>;
  reconnectMcp(sessionId: string | undefined, name: string): Promise<void>;
  listPluginMarketplace(sessionId?: string, workDir?: string): Promise<PluginMarketplaceView>;
  listBackgroundTasks(sessionId: string): Promise<readonly BackgroundTaskView[]>;
  getBackgroundTaskOutput(sessionId: string, taskId: string, tail?: number): Promise<string>;
  stopBackgroundTask(sessionId: string, taskId: string): Promise<void>;
  listAutomations(): Promise<readonly Automation[]>;
  saveAutomation(input: Omit<Automation, 'id' | 'createdAt'> & { readonly id?: string }): Promise<Automation>;
  deleteAutomation(id: string): Promise<void>;
  runAutomation(id: string): Promise<void>;
  listInbox(): Promise<readonly InboxItem[]>;
  markInboxRead(id: string): Promise<void>;
  deleteInbox(id: string): Promise<void>;
  markAllInboxRead(): Promise<void>;
  inboxUnreadCount(): Promise<number>;
  searchMemories(query: string, projectPath?: string): Promise<readonly MemoryRecord[]>;
  saveMemory(input: Pick<MemoryRecord, 'content' | 'projectPath' | 'tags'> & { readonly id?: string }): Promise<MemoryRecord>;
  deleteMemory(id: string): Promise<void>;
  listSites(): Promise<readonly SiteRecord[]>;
  saveSite(input: Omit<SiteRecord, 'id' | 'createdAt' | 'updatedAt'> & { readonly id?: string }): Promise<SiteRecord>;
  serveSite(id: string, lan?: boolean): Promise<SiteRecord>;
  stopSite(id: string): Promise<SiteRecord>;
  deleteSite(id: string): Promise<void>;
  pickSiteDirectory(): Promise<string | undefined>;
  indexStatus(workDir: string): Promise<IndexStatus>;
  assessProjectIndex(
    workDir: string,
    additionalDirs?: readonly string[],
  ): Promise<IndexRiskAssessment | undefined>;
  activateProjectIndex(
    workDir: string,
    additionalDirs?: readonly string[],
    options?: IndexActivateOptions,
  ): Promise<IndexStatus>;
  cancelProjectIndex(workDir: string): Promise<IndexStatus>;
  deactivateProjectIndex(workDir: string): Promise<void>;
  rebuildProjectIndex(workDir: string): Promise<IndexStatus>;
  searchProjectIndex(input: IndexSearchRequest): Promise<readonly IndexSearchHit[]>;
  previewIndexContext(input: IndexContextPreviewRequest): Promise<IndexContextPreview>;
  getSettings(): Promise<AppSettings>;
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  revealLogs(): Promise<void>;
  onSessionEvent(listener: (event: EventEnvelope) => void): () => void;
  onApproval(listener: (request: PendingApproval) => void): () => void;
  onQuestion(listener: (request: PendingQuestion) => void): () => void;
  onDebugVerification(listener: (request: PendingDebugVerification) => void): () => void;
  onTerminalData(listener: (event: TerminalDataEvent) => void): () => void;
  onTerminalExit(listener: (event: { readonly id: string; readonly exitCode: number }) => void): () => void;
  onBrowserState(listener: (tab: BrowserTab) => void): () => void;
  onAutomationState(listener: () => void): () => void;
  onInboxState(listener: () => void): () => void;
  onNavigate(listener: (route: string) => void): () => void;
  onOpenProjectRequest(listener: () => void): () => void;
}
