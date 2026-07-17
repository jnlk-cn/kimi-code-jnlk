import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Archive,
  AtSign,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  Bookmark,
  Boxes,
  Brain,
  Bug,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Clock3,
  Code2,
  Command,
  Copy,
  Eraser,
  FileCode2,
  FileDiff,
  FileText,
  Folder,
  FolderGit2,
  FolderOpen,
  FolderPlus,
  GitBranch,
  GitPullRequest,
  Globe2,
  Hash,
  House,
  Inbox,
  Laptop,
  ListTodo,
  LoaderCircle,
  Maximize2,
  MemoryStick,
  MessageCircle,
  MessageSquare,
  MoonStar,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  PanelLeft,
  PanelRight,
  Hammer,
  Play,
  Plug,
  Plus,
  Pin,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  SlidersHorizontal,
  Sparkles,
  SquareDashedMousePointer,
  Star,
  TerminalSquare,
  Trash2,
  User,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import type {
  AppSettings,
  ApprovalResolution,
  AuthStatus,
  BackgroundTaskView,
  BootstrapInfo,
  BrowserAnnotation,
  BrowserTab,
  CatalogProviderOption,
  ContextUsageSnapshot,
  DeepSeekBillingSnapshot,
  EditorPresetView,
  EventEnvelope,
  FileContent,
  FileEntry,
  IndexContextPreview,
  IndexRiskAssessment,
  IndexStatus,
  InteractionMode,
  ModelConfiguration,
  ModelOption,
  PathSuggestion,
  PendingApproval,
  PendingDebugVerification,
  PendingQuestion,
  PluginCommandView,
  QuestionResolution,
  DebugVerificationResolution,
  ProjectSummary,
  PromptAttachment,
  PromptReference,
  SessionSnapshot,
  SessionStatusView,
  SkillView,
  TaskSummary,
  TerminalInfo,
} from '../shared/contracts';
import { INTERACTION_MODE_LABELS } from '../shared/contracts';
import {
  hexToRgbTriplet,
  resolveAccentColor,
  resolveThemeMode,
} from '../shared/theme-accent';
import {
  describeAuthStatus,
  isAuthenticated,
} from './presentation';
import type { AgentSubagentView } from './agent-subagent';
import {
  type SwarmModeEntry,
  type SwarmProgressView,
} from './agent-swarm';
import { ChildAgentEventRouter } from './child-agent-event-router';
import {
  appendSwarmMarker,
  isFrameBatchedTimelineEvent,
  reduceLiveEvent,
  replayTimeline,
  type TimelineEntry,
} from './timeline';
import {
  createFrameCommitScheduler,
  type FrameCommitScheduler,
} from './timeline-frame-scheduler';
import { patchStatusFromEvent } from './session-event-state';
import {
  initialTimelineWindowStart,
  isTimelineNearBottom,
  previousTimelineWindowStart,
  scrollTimelineToBottom,
  scrollTimelineToElement,
  stagedTimelineWindowStart,
  shouldTimelineAutoScroll,
  TIMELINE_INITIAL_RENDER_SLICE,
  timelineWindowStartForIndex,
} from './timeline-scroll';
import {
  buildSessionTurns,
  latestCompletedTurnWithEdits,
  turnAnchorId,
  type SessionTurn,
} from './session-turns';
import { AgentSwarmProgressView } from './components/agent-swarm-progress';
import { CodeSurface } from './components/code-surface';
import { ComposerQueueBar } from './components/composer-queue-bar';
import { ComposerTodoBar } from './components/composer-todo-bar';
import { DebugVerificationBar } from './components/debug-verification-bar';
import { ContextUsagePopover } from './components/context-usage-popover';
import { ContextUsageRing } from './components/context-usage-ring';
import { EditorShortcuts } from './components/editor-shortcuts';
import { IndexRiskModal } from './components/index-risk-modal';
import { TopbarIndexStatus } from './components/topbar-index-status';
import { MarkdownMessage } from './components/markdown-message';
import { StreamingAssistantMessage } from './components/streaming-assistant-message';
import { StreamingThinkingBody } from './components/streaming-thinking-body';
import { PlanBoxView } from './components/plan-box-view';
import { PlanBuildControls } from './components/plan-build-controls';
import { PlansPanel } from './components/plans-panel';
import { QuestionBar } from './components/question-bar';
import {
  enqueueComposerItem,
  promoteQueuedComposerItem,
  removeQueuedComposerItem,
  shiftQueuedComposerItem,
  takeQueuedComposerItem,
  type QueuedComposerItem,
} from './composer-queue';
import { modelLabel, modelMenuItems, modelShortLabel, thinkingLabel } from './model-menu';
import {
  forceActivateProjectIndex,
  optOutProjectIndex,
  prepareProjectIndexActivation,
} from './project-index-activation';
import {
  SwarmStartPermissionModal,
  type SwarmStartPermissionChoice,
} from './components/swarm-start-permission-modal';
import { ReviewPanel } from './components/review-panel';
import { TimelineTurnRail } from './components/timeline-turn-rail';
import { ToolBlockView } from './components/tool-block-view';
import { TurnEditsSummaryBar } from './components/turn-edits-summary-bar';
import { WorkspaceBottomBar } from './components/workspace-bottom-bar';
import {
  GanymedeMark,
  WorkspaceSidebar,
  type WorkspaceRoute,
} from './components/workspace-sidebar';
import {
  isUtilityPanel,
  isUtilityRoute,
  panelLabel,
  toggleWorkspacePanel,
  type WorkspacePanel,
  type WorkspaceToolPanel,
} from './components/workspace-panels';
import {
  browserTabsRestoreKey,
  browserTabsToRestore,
  readGlobalUi,
  readProjectUi,
  readSessionUi,
  snapshotFromBrowserTabs,
  writeGlobalUi,
  writeProjectUi,
  writeSessionUi,
} from './workspace-ui-persistence';
import {
  readProjectRuntime,
  readSessionRuntime,
  writeProjectRuntime,
  writeSessionRuntime,
} from './workspace-runtime-ui';
import { RAIL_CHROME_WIDTH, WorkspaceRail } from './components/workspace-rail';
import {
  WorkspaceRailChromeProvider,
  WorkspaceRailChromeSlot,
  type WorkspaceRailHeaderSlot,
} from './components/workspace-rail-chrome';
import {
  composerFooterHint,
  composerPlaceholder,
  composerModeHint,
  interactionModeClassName,
  interactionModeMenuDescription,
  INTERACTION_MODE_MENU_ORDER,
  nextShiftTabInteractionMode,
} from './composer-mode-ui';
import { estimateTokensFromCharCount, resolveContextUsageDisplay } from './context-usage';
import { estimateReplayIndexContextChars } from './index-replay-context';
import { isHtmlPath, languageFromPath } from './language-from-path';
import {
  isWorkspaceSpecPath,
  resolveWorkspaceAbsolutePath,
} from '../shared/plan-paths';
import {
  isPlanReviewApproval,
  parsePlanReviewDisplay,
} from './plan-review';
import {
  latestExitPlanEntry,
  pendingPlanReviewForTimelineEntry,
  shouldSuppressPlanAssistantStream,
} from './plan-timeline';
import { PageFrame, messageOf } from './page-chrome';
import { InboxPage } from './pages/inbox-page';
import { MemoryPage } from './pages/memory-page';
import { PluginsPage } from './pages/plugins-page';
import { PullsPage } from './pages/pulls-page';
import { ScheduledPage } from './pages/scheduled-page';
import { GitSyncPage } from './pages/git-sync-page';
import { SitesPage } from './pages/sites-page';
import {
  composerItemsToPlanTodos,
  resolveActivePlanPath,
  resolveUnifiedTodos,
} from './plan-todo-sync';
import {
  shouldHideTodoBar,
  todosFromTodoListArgs,
  type TodoItem,
} from './todo-panel';
import {
  AppMenuPopover,
  anchorFromElement,
  type AppMenuItem,
  type MenuAnchor,
} from './app-menu';
import { modelProviderIcon } from './model-provider-icon';
import {
  canAttachFile,
  fileToAttachment,
  filesFromDataTransfer,
  imageFilesFromClipboard,
  mergeAttachments,
} from './composer-attachments';
import {
  composerTriggerAt,
  fuzzyTextMatch,
  removeComposerTrigger,
  resolveSlashSubmitText,
  type ComposerTrigger,
  type TriggerContext,
} from './composer-support';
import {
  permissionDescription,
  permissionToolbarLabel,
} from './permission-ui';
import {
  handleAlignedSlashCommand,
  type ComposerMenuKind,
  type SlashCommandHost,
} from './slash-commands';
import {
  buildWorkspacePickerItems,
  WorkspacePickerPopover,
} from './workspace-picker';
import {
  DEFAULT_MONO_FONT,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_XTERM_THEME,
  normalizeFontFamily,
  readTerminalThemeFromDocument,
  resolveMonoFont,
  resolveTerminalFontSize,
} from './terminal-options';

type Route = WorkspaceRoute;
type Panel = WorkspacePanel;
type TimelineUpdate =
  | readonly TimelineEntry[]
  | ((current: readonly TimelineEntry[]) => readonly TimelineEntry[]);

interface DesktopCommand {
  readonly slash: string;
  readonly label: string;
  readonly description: string;
  readonly icon: ReactNode;
  readonly shortcut?: string;
  readonly onSelect: () => void;
}

const api = window.ganymede;
const initialGlobalUi = readGlobalUi();

function openExternalFromTimeline(url: string): void {
  void api.openExternal(url);
}

export function App(): ReactNode {
  const [boot, setBoot] = useState<BootstrapInfo>();
  const [settings, setSettings] = useState<AppSettings>();
  const [projects, setProjects] = useState<readonly ProjectSummary[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<readonly ProjectSummary[]>([]);
  const [tasks, setTasks] = useState<readonly TaskSummary[]>([]);
  const [referenceTasks, setReferenceTasks] = useState<readonly TaskSummary[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectSummary>();
  const [session, setSession] = useState<SessionSnapshot>();
  const [timeline, setTimeline] = useState<readonly TimelineEntry[]>([]);
  const [route, setRoute] = useState<Route>(() => initialGlobalUi.route);
  const [panel, setPanel] = useState<Panel>('none');
  const [sidebarOpen, setSidebarOpen] = useState(() => initialGlobalUi.sidebarOpen);
  const [workspacePanelDockOpen, setWorkspacePanelDockOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => storedNumber('ganymede.sidebarWidth', 248));
  const [sidePanelWidth, setSidePanelWidth] = useState(() => storedNumber('ganymede.sidePanelWidth', 420));
  const [browserPanelWidth, setBrowserPanelWidth] = useState(() => storedNumber('ganymede.browserPanelWidth', 640));
  const [terminalHeight, setTerminalHeight] = useState(() => storedNumber('ganymede.terminalHeight', 250));
  const [bottomTerminalOpen, setBottomTerminalOpen] = useState(false);
  const [railHeader, setRailHeader] = useState<WorkspaceRailHeaderSlot>();
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<readonly PromptAttachment[]>([]);
  const [references, setReferences] = useState<readonly PromptReference[]>([]);
  const [approval, setApproval] = useState<PendingApproval>();
  const [selectedPlanPath, setSelectedPlanPath] = useState<string | undefined>(() =>
    initialGlobalUi.activeProjectWorkDir === undefined
      ? undefined
      : readProjectUi(initialGlobalUi.activeProjectWorkDir).selectedPlanPath,
  );
  const [question, setQuestion] = useState<PendingQuestion>();
  const [debugVerification, setDebugVerification] = useState<PendingDebugVerification>();
  const [composerQueue, setComposerQueue] = useState<readonly QueuedComposerItem[]>([]);
  const [indexRiskPrompt, setIndexRiskPrompt] = useState<{
    readonly assessment: IndexRiskAssessment;
    readonly workDir: string;
    readonly additionalDirs: readonly string[];
  }>();
  const [error, setError] = useState<string>();
  const [commandOpen, setCommandOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [target, setTarget] = useState<'local' | 'worktree' | 'ssh'>('local');
  const [sshProfileId, setSshProfileId] = useState<string>();
  const [draftInteractionMode, setDraftInteractionMode] = useState<InteractionMode>('agent');
  const [draftPermission, setDraftPermission] = useState<'manual' | 'auto' | 'yolo'>('manual');
  const [draftModel, setDraftModel] = useState<string>();
  const [draftThinking, setDraftThinking] = useState<string>();
  const [composerMenuRequest, setComposerMenuRequest] = useState<ComposerMenuKind>();
  const [availableSkills, setAvailableSkills] = useState<readonly SkillView[]>([]);
  const [pluginCommands, setPluginCommands] = useState<readonly PluginCommandView[]>([]);
  const [renameTarget, setRenameTarget] = useState<{ readonly id: string; readonly title: string }>();
  const [removeProjectTarget, setRemoveProjectTarget] = useState<ProjectSummary>();
  const [workspacePicker, setWorkspacePicker] = useState<{ readonly anchor: MenuAnchor }>();
  const [browserPreviewUrl, setBrowserPreviewUrl] = useState<string>();
  const [availableEditors, setAvailableEditors] = useState<readonly EditorPresetView[]>([]);
  const [swarmRevision, setSwarmRevision] = useState(0);
  const swarmRevisionRef = useRef(0);
  const swarmRevisionSchedulerRef = useRef<FrameCommitScheduler<number> | undefined>(undefined);
  if (swarmRevisionSchedulerRef.current === undefined) {
    swarmRevisionSchedulerRef.current = createFrameCommitScheduler(setSwarmRevision, {
      request: (callback) => window.requestAnimationFrame(callback),
      cancel: (handle) => window.cancelAnimationFrame(handle),
    });
  }
  const bumpSwarmRevision = useCallback((priority: 'frame' | 'immediate' = 'immediate'): void => {
    swarmRevisionRef.current += 1;
    if (priority === 'frame') {
      swarmRevisionSchedulerRef.current?.schedule(swarmRevisionRef.current);
    } else {
      swarmRevisionSchedulerRef.current?.commitNow(swarmRevisionRef.current);
    }
  }, []);
  const [swarmModeEntry, setSwarmModeEntry] = useState<SwarmModeEntry>();
  const [swarmPermission, setSwarmPermission] = useState<{
    readonly restoreText: string;
    readonly onSelect: (choice: SwarmStartPermissionChoice) => Promise<void>;
  }>();
  const [sessionTodos, setSessionTodos] = useState<readonly TodoItem[]>([]);
  const [boundPlanContent, setBoundPlanContent] = useState<string | undefined>();
  const boundPlanContentRef = useRef<string | undefined>(undefined);
  boundPlanContentRef.current = boundPlanContent;
  const [plansRefreshToken, setPlansRefreshToken] = useState(0);
  const [backgroundBadge, setBackgroundBadge] = useState<{
    readonly agents: number;
    readonly tasks: number;
  }>({ agents: 0, tasks: 0 });
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [inboxAutomationFilter, setInboxAutomationFilter] = useState<string>();
  const activeSessionId = useRef<string | undefined>(undefined);
  const statusRef = useRef<SessionStatusView | undefined>(undefined);
  const timelineRef = useRef<readonly TimelineEntry[]>([]);
  const timelineSummaryRevisionRef = useRef(0);
  const timelineSchedulerRef = useRef<FrameCommitScheduler<readonly TimelineEntry[]> | undefined>(
    undefined,
  );
  if (timelineSchedulerRef.current === undefined) {
    timelineSchedulerRef.current = createFrameCommitScheduler(setTimeline, {
      request: (callback) => window.requestAnimationFrame(callback),
      cancel: (handle) => window.cancelAnimationFrame(handle),
    });
  }
  const updateTimeline = useCallback(
    (update: TimelineUpdate, priority: 'frame' | 'immediate' = 'immediate'): void => {
      const next = typeof update === 'function' ? update(timelineRef.current) : update;
      if (next === timelineRef.current) return;
      timelineRef.current = next;
      if (priority === 'frame') timelineSchedulerRef.current?.schedule(next);
      else timelineSchedulerRef.current?.commitNow(next);
    },
    [],
  );
  const composerQueueRef = useRef<readonly QueuedComposerItem[]>([]);
  const queueDispatchPendingRef = useRef(false);
  const childAgentRouterRef = useRef(new ChildAgentEventRouter());
  const swarmModeEntryRef = useRef<SwarmModeEntry | undefined>(undefined);
  swarmModeEntryRef.current = swarmModeEntry;
  statusRef.current = session?.status;
  composerQueueRef.current = composerQueue;
  const activeProjectWorkDirRef = useRef<string | undefined>(undefined);
  activeProjectWorkDirRef.current = activeProject?.workDir;
  const openPlanInPanelRef = useRef<(path?: string) => void>(() => undefined);
  const swarmState = childAgentRouterRef.current.getSwarmController().getState();
  const agentSubagents = childAgentRouterRef.current.getAgentController().getState();
  void swarmRevision;
  const sessionTurns = useStableSessionTurns(
    timeline,
    `${session?.id ?? 'draft'}:${String(timelineSummaryRevisionRef.current)}`,
  );
  const editsSummaryTurn = latestCompletedTurnWithEdits(
    sessionTurns,
    session?.status.running ?? false,
  );
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const appShellRef = useRef<HTMLDivElement>(null);
  const [requestedTurnId, setRequestedTurnId] = useState<string>();
  const scrollToTurn = useCallback((turnId: string) => {
    setRequestedTurnId(turnId);
  }, []);
  const handleRequestedTurnHandled = useCallback(() => {
    setRequestedTurnId(undefined);
  }, []);
  const previewShellSize = useCallback((property: string, value: number): void => {
    appShellRef.current?.style.setProperty(property, `${String(value)}px`);
  }, []);
  const previewRailContentWidth = useCallback((value: number): void => {
    previewShellSize('--rail-content-width', value);
    previewShellSize('--rail-width', RAIL_CHROME_WIDTH + value);
  }, [previewShellSize]);

  useEffect(() => () => {
    timelineSchedulerRef.current?.cancel();
    swarmRevisionSchedulerRef.current?.cancel();
  }, []);

  useEffect(() => {
    writeGlobalUi({
      sidebarOpen,
      route,
    });
  }, [sidebarOpen, route]);

  useEffect(() => {
    writeGlobalUi({
      activeProjectWorkDir: activeProject?.workDir ?? '',
    });
  }, [activeProject?.workDir]);

  useEffect(() => {
    writeGlobalUi({
      activeSessionId: session?.id ?? '',
    });
  }, [session?.id]);

  const selectPanel = useCallback((next: Panel | ((current: Panel) => Panel)) => {
    const apply = (resolved: Panel, current: Panel): Panel => {
      if (resolved === 'pulls' && activeProject === undefined) {
        setError('请先选择一个 Git 项目。');
        return current;
      }
      if (resolved !== 'inbox') setInboxAutomationFilter(undefined);
      if (resolved !== 'none') {
        setWorkspacePanelDockOpen(true);
      }
      return resolved;
    };
    if (typeof next === 'function') {
      setPanel((current) => apply(next(current), current));
      return;
    }
    setPanel((current) => apply(next, current));
  }, [activeProject]);

  const closeWorkspacePanel = useCallback(() => {
    setPanel('none');
  }, []);

  const openPlanInPanel = useCallback((path?: string) => {
    if (path !== undefined && path.length > 0) {
      setSelectedPlanPath(path);
      if (activeProject !== undefined) {
        writeProjectUi(activeProject.workDir, { selectedPlanPath: path });
      }
    }
    selectPanel('plans');
  }, [activeProject, selectPanel]);
  openPlanInPanelRef.current = openPlanInPanel;

  const openPlanPathFromChat = useCallback(
    (rawPath: string) => {
      const workDir = activeProject?.workDir;
      if (workDir === undefined) return;
      const absolute = resolveWorkspaceAbsolutePath(workDir, rawPath);
      openPlanInPanel(absolute);
      setPlansRefreshToken((value) => value + 1);
    },
    [activeProject?.workDir, openPlanInPanel],
  );

  const activePlanPath = resolveActivePlanPath({
    planFilePath: session?.status.planFilePath,
    approvedPlanPath: session?.status.approvedPlanPath,
  });
  const unifiedTodos = useMemo(
    () =>
      resolveUnifiedTodos({
        activePlanPath,
        planContent: boundPlanContent,
        sessionTodos,
      }),
    [activePlanPath, boundPlanContent, sessionTodos],
  );

  const reloadBoundPlan = useCallback(async (path: string | undefined) => {
    if (path === undefined || path.length === 0) {
      setBoundPlanContent(undefined);
      return;
    }
    try {
      const content = await api.readPlanFile({
        path,
        workDir: activeProjectWorkDirRef.current,
      });
      setBoundPlanContent(content);
      setPlansRefreshToken((value) => value + 1);
    } catch {
      setBoundPlanContent(undefined);
    }
  }, []);

  useEffect(() => {
    void reloadBoundPlan(activePlanPath);
  }, [activePlanPath, reloadBoundPlan, session?.id]);

  const lastAutoOpenedPlanRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (activePlanPath === undefined) {
      lastAutoOpenedPlanRef.current = undefined;
      return;
    }
    if (lastAutoOpenedPlanRef.current === activePlanPath) return;
    lastAutoOpenedPlanRef.current = activePlanPath;
    openPlanInPanel(activePlanPath);
  }, [activePlanPath, openPlanInPanel]);

  const resolvePlanApproval = useCallback(
    (resolution: ApprovalResolution) => {
      const pending = approval;
      void api.resolveApproval(resolution);
      setApproval(undefined);
      if (
        resolution.decision === 'approved' &&
        pending !== undefined &&
        isPlanReviewApproval(pending)
      ) {
        const display = parsePlanReviewDisplay(pending.display);
        const path = display?.path;
        if (path !== undefined && path.length > 0) {
          setSession((current) =>
            current === undefined
              ? current
              : {
                  ...current,
                  status: { ...current.status, approvedPlanPath: path },
                },
          );
          openPlanInPanel(path);
          void reloadBoundPlan(path);
        }
      }
    },
    [approval, openPlanInPanel, reloadBoundPlan],
  );

  const openedPlanApprovalIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (approval === undefined || !isPlanReviewApproval(approval)) {
      if (approval === undefined) openedPlanApprovalIdRef.current = undefined;
      return;
    }
    if (openedPlanApprovalIdRef.current === approval.id) return;
    openedPlanApprovalIdRef.current = approval.id;
    const display = parsePlanReviewDisplay(approval.display);
    openPlanInPanel(display?.path);
  }, [approval, openPlanInPanel]);

  useEffect(() => {
    if (activeProject === undefined) {
      setSelectedPlanPath(undefined);
      return;
    }
    setSelectedPlanPath(readProjectUi(activeProject.workDir).selectedPlanPath);
  }, [activeProject?.workDir]);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      api.listSkills(session?.id, activeProject?.workDir),
      session === undefined ? Promise.resolve([]) : api.listPluginCommands(session.id),
    ]).then(([skills, commands]) => {
      if (!alive) return;
      setAvailableSkills(skills.filter((skill) => skill.userActivatable));
      setPluginCommands(commands);
    }).catch(() => {
      if (!alive) return;
      setAvailableSkills([]);
      setPluginCommands([]);
    });
    return () => { alive = false; };
  }, [session?.id, activeProject?.workDir, commandOpen, route]);

  useEffect(() => {
    activeSessionId.current = session?.id;
  }, [session?.id]);

  useEffect(() => {
    if (session === undefined) {
      setBackgroundBadge({ agents: 0, tasks: 0 });
      return;
    }
    let alive = true;
    const refreshBadge = (): void => {
      void api.listBackgroundTasks(session.id)
        .then((tasks) => {
          if (!alive) return;
          let agents = 0;
          let bash = 0;
          for (const task of tasks) {
            if (task.status !== 'running') continue;
            if (task.kind === 'agent') agents += 1;
            else bash += 1;
          }
          setBackgroundBadge({ agents, tasks: bash });
        })
        .catch(() => {
          if (alive) setBackgroundBadge({ agents: 0, tasks: 0 });
        });
    };
    refreshBadge();
    const timer = window.setInterval(refreshBadge, 2_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [session?.id, session?.status.running, swarmRevision]);

  useEffect(() => {
    let alive = true;
    const refreshEditors = (): void => {
      void api.listAvailableEditors().then((editors) => {
        if (alive) setAvailableEditors(editors);
      }).catch(() => {
        if (alive) setAvailableEditors([]);
      });
    };
    refreshEditors();
    window.addEventListener('focus', refreshEditors);
    return () => {
      alive = false;
      window.removeEventListener('focus', refreshEditors);
    };
  }, []);

  const preferEditor = useCallback(async (command: string) => {
    try {
      const next = await api.setSettings({ editorCommand: command });
      setSettings(next);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, []);

  const openWorkspacePreview = useCallback(async (workDir: string, relativePath: string) => {
    try {
      const url = await api.previewWorkspaceFile(workDir, relativePath);
      setBrowserPreviewUrl(url);
      selectPanel('browser');
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, []);

  const openPathInEditor = useCallback(async (path: string, command?: string) => {
    try {
      await api.openInEditor(path, command);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, []);

  const resolveWorkspacePath = useCallback((workDir: string | undefined, path: string): string => {
    if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return path;
    if (workDir === undefined) return path;
    return `${workDir.replace(/[/\\]$/, '')}/${path.replace(/^[/\\]+/, '')}`;
  }, []);

  const previewTimelineFile = useCallback((relativePath: string): void => {
    const workDir = activeProjectWorkDirRef.current;
    if (workDir === undefined) return;
    void openWorkspacePreview(workDir, relativePath);
  }, [openWorkspacePreview]);

  const openTimelinePathInEditor = useCallback((path: string): void => {
    void openPathInEditor(resolveWorkspacePath(activeProjectWorkDirRef.current, path));
  }, [openPathInEditor, resolveWorkspacePath]);

  const refreshProjects = useCallback(async () => {
    const [next, hidden] = await Promise.all([
      api.listProjects(),
      api.listHiddenProjects(),
    ]);
    setProjects(next);
    setArchivedProjects(hidden);
    // isGitRepository is computed at list time, not persisted — keep activeProject in sync.
    setActiveProject((current) => {
      if (current === undefined) return current;
      return next.find((project) => project.workDir === current.workDir) ?? current;
    });
    return next;
  }, []);

  const refreshTasks = useCallback(async (_workDir?: string) => {
    const [active, history] = await Promise.all([
      api.listSessions(),
      api.listSessions(undefined, true),
    ]);
    setTasks(active);
    setReferenceTasks(history);
  }, []);

  useEffect(() => {
    let alive = true;
    const unsubscribers = [
      api.onSessionEvent((event) => {
        if (!alive) return;
        const statusEvent = event.event;
        const statusType = String(statusEvent['type'] ?? '');
        if (statusType === 'mcp.oauth.authorization_url') {
          const url =
            typeof statusEvent['url'] === 'string'
              ? statusEvent['url']
              : typeof statusEvent['authorizationUrl'] === 'string'
                ? statusEvent['authorizationUrl']
                : undefined;
          if (url !== undefined) void api.openExternal(url);
        }
        if (event.sessionId === activeSessionId.current) {
          // Patch status first so turn.step.completed timing uses the mode after
          // agent.status.updated in the same event stream (avoid stale statusRef).
          const patchedStatus =
            statusRef.current === undefined
              ? undefined
              : patchStatusFromEvent(statusRef.current, event.event);
          if (patchedStatus !== undefined) {
            statusRef.current = patchedStatus;
          }
          const debugMode =
            patchedStatus?.interactionMode === 'debug' ||
            patchedStatus?.debugMode === true ||
            statusRef.current?.interactionMode === 'debug' ||
            statusRef.current?.debugMode === true;
          const consumed = childAgentRouterRef.current.routeEvent(event.event);
          if (consumed) {
            bumpSwarmRevision(isFrameBatchedTimelineEvent(event.event) ? 'frame' : 'immediate');
          }
          if (statusType === 'tool.result' || statusType === 'turn.ended') {
            timelineSummaryRevisionRef.current += 1;
          }
          if (
            statusType === 'tool.result' &&
            statusEvent['isError'] !== true
          ) {
            const toolCallId = String(statusEvent['toolCallId'] ?? '');
            const match = timelineRef.current.find(
              (entry) => entry.toolCallId === toolCallId,
            );
            if (match?.title === 'TodoList') {
              const nextTodos = todosFromTodoListArgs(match.toolArgs);
              if (nextTodos !== undefined) {
                const planPath = resolveActivePlanPath({
                  planFilePath: statusRef.current?.planFilePath,
                  approvedPlanPath: statusRef.current?.approvedPlanPath,
                });
                if (planPath !== undefined && activeSessionId.current !== undefined) {
                  const existing = resolveUnifiedTodos({
                    activePlanPath: planPath,
                    planContent: boundPlanContentRef.current,
                    sessionTodos: [],
                  }).planTodos;
                  void api
                    .patchPlanTodos({
                      sessionId: activeSessionId.current,
                      path: planPath,
                      todos: composerItemsToPlanTodos(nextTodos, existing),
                    })
                    .then((content) => {
                      setBoundPlanContent(content);
                      setPlansRefreshToken((value) => value + 1);
                    })
                    .catch(() => {
                      setSessionTodos(nextTodos);
                    });
                } else {
                  setSessionTodos(nextTodos);
                }
              }
            } else if (
              match !== undefined &&
              (match.title === 'Write' || match.title === 'Edit')
            ) {
              const planPath = resolveActivePlanPath({
                planFilePath: statusRef.current?.planFilePath,
                approvedPlanPath: statusRef.current?.approvedPlanPath,
              });
              const written = toolArgsPath(match.toolArgs);
              const workDir = activeProjectWorkDirRef.current;
              if (
                planPath !== undefined &&
                written !== undefined &&
                pathsEqual(written, planPath)
              ) {
                void api.readPlanFile({ path: planPath, workDir }).then((content) => {
                  setBoundPlanContent(content);
                  setPlansRefreshToken((value) => value + 1);
                }).catch(() => undefined);
              } else if (
                written !== undefined
                && workDir !== undefined
                && isWorkspaceSpecPath(written, workDir)
              ) {
                const absolute = resolveWorkspaceAbsolutePath(workDir, written);
                openPlanInPanelRef.current(absolute);
                setPlansRefreshToken((value) => value + 1);
              }
            }
          }
          if (statusType === 'agent.status.updated') {
            const swarmOff =
              statusEvent['swarmMode'] === false ||
              statusEvent['interactionMode'] === 'agent' ||
              statusEvent['interactionMode'] === 'engineering' ||
              statusEvent['interactionMode'] === 'plan' ||
              statusEvent['interactionMode'] === 'ask' ||
              statusEvent['interactionMode'] === 'debug';
            if (swarmOff && swarmModeEntryRef.current === 'task') {
              updateTimeline((entries) => appendSwarmMarker(
                reduceLiveEvent(entries, event, {
                  debugMode,
                  suppressForegroundSubagents: true,
                }),
                'ended',
              ));
              setSwarmModeEntry(undefined);
            } else {
              if (swarmOff) setSwarmModeEntry(undefined);
              updateTimeline((entries) => reduceLiveEvent(entries, event, {
                debugMode,
                suppressForegroundSubagents: true,
              }));
            }
          } else {
            updateTimeline(
              (entries) => reduceLiveEvent(entries, event, {
                debugMode,
                suppressForegroundSubagents: true,
              }),
              isFrameBatchedTimelineEvent(event.event) ? 'frame' : 'immediate',
            );
          }
          setSession((current) => {
            if (current?.id !== event.sessionId) return current;
            const nextStatus = patchStatusFromEvent(current.status, event.event);
            return nextStatus === current.status ? current : { ...current, status: nextStatus };
          });
        }
      }),
      api.onApproval((request) => {
        if (!alive) return;
        timelineSchedulerRef.current?.flush();
        swarmRevisionSchedulerRef.current?.flush();
        setApproval(request);
      }),
      api.onQuestion((request) => {
        if (!alive) return;
        timelineSchedulerRef.current?.flush();
        swarmRevisionSchedulerRef.current?.flush();
        setQuestion(request);
      }),
      api.onDebugVerification((request) => {
        if (!alive) return;
        timelineSchedulerRef.current?.flush();
        swarmRevisionSchedulerRef.current?.flush();
        setDebugVerification(request);
      }),
      api.onAutomationState(() => {
        void api.inboxUnreadCount().then(setInboxUnreadCount).catch(() => undefined);
      }),
      api.onInboxState(() => {
        void api.inboxUnreadCount().then(setInboxUnreadCount).catch(() => undefined);
      }),
      api.onNavigate((next) => {
        if (!alive || !isRoute(next)) return;
        setRoute(next);
        if (next === 'chat') setDraftInteractionMode('ask');
        if (next === 'new') setDraftInteractionMode('agent');
      }),
      api.onOpenProjectRequest(() => {
        if (alive) void chooseProject();
      }),
    ];
    void api.bootstrap()
      .then(async (info) => {
        if (!alive) return;
        setBoot(info);
        setSettings(info.settings);
        setDraftModel(info.defaultModel);
        setDraftThinking(info.defaultThinking);
        applyTheme(info.settings);
        applyShellStyle(info.shellStyle);
        void api.inboxUnreadCount().then(setInboxUnreadCount).catch(() => undefined);
        const listed = await refreshProjects();
        if (!alive) return;
        const restoredProject = listed.find((project) => project.workDir === initialGlobalUi.activeProjectWorkDir)
          ?? listed[0];
        if (restoredProject !== undefined) {
          setActiveProject(restoredProject);
          await Promise.all([
            refreshTasks(restoredProject.workDir),
            activateIndexForProject(restoredProject).catch(() => undefined),
          ]);
        }
        if (!alive || initialGlobalUi.activeSessionId === undefined) return;
        try {
          const snapshot = await api.resumeSession(initialGlobalUi.activeSessionId);
          if (!alive) return;
          hydrateSessionSnapshot(snapshot);
          const sessionProject = listed.find((project) => project.workDir === snapshot.workDir);
          if (sessionProject !== undefined) setActiveProject(sessionProject);
        } catch {
          // Session may have been archived or removed.
        }
      })
      .catch((cause: unknown) => {
        if (alive) setError(messageOf(cause));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [refreshProjects, refreshTasks]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      } else if (mod && event.altKey && event.code === 'KeyB') {
        event.preventDefault();
        setWorkspacePanelDockOpen((value) => !value);
      } else if (mod && !event.altKey && event.key === 'b') {
        event.preventDefault();
        setSidebarOpen((value) => !value);
      } else if (mod && event.key === 'j') {
        event.preventDefault();
        setBottomTerminalOpen((value) => !value);
      } else if (mod && !event.shiftKey && event.key === 'p') {
        event.preventDefault();
        selectPanel((value) => toggleWorkspacePanel(value, 'files'));
      } else if (mod && !event.shiftKey && event.key === 't') {
        event.preventDefault();
        selectPanel((value) => toggleWorkspacePanel(value, 'browser'));
      } else if (mod && event.shiftKey && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        selectPanel((value) => toggleWorkspacePanel(value, 'review'));
      } else if (mod && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        selectPanel((value) => toggleWorkspacePanel(value, 'plans'));
      } else if (mod && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectPanel((value) => toggleWorkspacePanel(value, 'agents'));
      } else if (mod && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        selectPanel((value) => toggleWorkspacePanel(value, 'summary'));
      } else if (mod && event.key === 'n') {
        event.preventDefault();
        void startNewTask();
      } else if (event.key === 'Escape') {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  async function activateIndexForProject(project: ProjectSummary): Promise<void> {
    const outcome = await prepareProjectIndexActivation(
      api,
      project.workDir,
      project.additionalDirs,
    );
    if (outcome.kind === 'needs_confirmation') {
      setIndexRiskPrompt({
        assessment: outcome.assessment,
        workDir: outcome.workDir,
        additionalDirs: outcome.additionalDirs,
      });
    }
  }

  async function chooseProject(): Promise<void> {
    try {
      const project = await api.openProject();
      if (project === undefined) return;
      setActiveProject(project);
      setSession(undefined);
      activeSessionId.current = undefined;
      updateTimeline([]);
      setSessionTodos([]);
      setRoute('new');
      await Promise.all([
        refreshProjects(),
        refreshTasks(project.workDir),
        activateIndexForProject(project).catch(() => undefined),
      ]);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function selectProject(project: ProjectSummary): Promise<void> {
    const listed = await refreshProjects();
    const fresh = listed.find((item) => item.workDir === project.workDir) ?? project;
    setActiveProject(fresh);
    setSession(undefined);
    activeSessionId.current = undefined;
    updateTimeline([]);
    setSessionTodos([]);
    setRoute('new');
    await Promise.all([
      refreshTasks(fresh.workDir),
      activateIndexForProject(fresh).catch(() => undefined),
    ]);
  }

  function addProjectDirectory(workDir: string, sessionId?: string): void {
    void api.addProjectDirectory(workDir, sessionId).then(async (dirs) => {
      const nextProject =
        activeProject?.workDir === workDir
          ? { ...activeProject, additionalDirs: dirs }
          : undefined;
      if (nextProject !== undefined) {
        setActiveProject(nextProject);
      }
      if (sessionId !== undefined) {
        setSession((current) =>
          current === undefined || current.id !== sessionId
            ? current
            : { ...current, additionalDirs: dirs },
        );
      }
      await refreshProjects();
      if (nextProject !== undefined) {
        await activateIndexForProject(nextProject).catch(() => undefined);
      }
    }).catch((cause) => setError(messageOf(cause)));
  }

  async function openTask(task: TaskSummary): Promise<void> {
    try {
      setLoading(true);
      const snapshot = await api.resumeSession(task.id);
      hydrateSessionSnapshot(snapshot);
      const listed = await refreshProjects();
      setActiveProject(
        listed.find((project) => project.workDir === task.workDir) ?? activeProject,
      );
      setRoute('new');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  function hydrateSessionSnapshot(snapshot: SessionSnapshot): void {
    childAgentRouterRef.current.reset();
    for (const envelope of snapshot.liveEvents) {
      childAgentRouterRef.current.routeEvent(envelope.event);
    }
    bumpSwarmRevision();
    setSwarmModeEntry(undefined);
    setSession(snapshot);
    activeSessionId.current = snapshot.id;
    setComposerQueue([]);
    queueDispatchPendingRef.current = false;
    setQuestion(undefined);
    setDebugVerification(undefined);
    timelineSummaryRevisionRef.current += 1;
    updateTimeline(replayTimeline(snapshot.replay, snapshot.liveEvents, {
      debugMode: snapshot.status.interactionMode === 'debug',
      suppressForegroundSubagents: true,
    }));
    setSessionTodos(snapshot.todos ?? []);
    setBoundPlanContent(undefined);
    setDraftInteractionMode(snapshot.status.interactionMode);
    setDraftPermission(snapshot.status.permission);
  }

  async function startNewTask(mode: InteractionMode = 'agent'): Promise<void> {
    setSession(undefined);
    activeSessionId.current = undefined;
    childAgentRouterRef.current.reset();
    bumpSwarmRevision();
    setSwarmModeEntry(undefined);
    updateTimeline([]);
    setSessionTodos([]);
    setBoundPlanContent(undefined);
    setComposerQueue([]);
    queueDispatchPendingRef.current = false;
    setQuestion(undefined);
    setDebugVerification(undefined);
    setPrompt('');
    setAttachments([]);
    setReferences([]);
    setRoute('new');
    setDraftInteractionMode(mode);
    setDraftModel(boot?.defaultModel);
    setDraftThinking(boot?.defaultThinking);
  }

  async function ensureActiveSession(): Promise<SessionSnapshot | undefined> {
    if (session !== undefined) return session;
    const workDir = activeProject?.workDir;
    if (workDir === undefined) {
      await chooseProject();
      return undefined;
    }
    if ((draftModel ?? boot?.defaultModel) === undefined) {
      setError('尚未配置模型。请在设置中登录 Kimi 模型账号，或添加兼容的模型服务。');
      return undefined;
    }
    const current = await api.createSession({
      workDir,
      model: draftModel ?? boot?.defaultModel,
      thinking: draftThinking ?? boot?.defaultThinking,
      permission: draftPermission,
      interactionMode: draftInteractionMode,
      target,
      sshProfileId,
      additionalDirs: activeProject?.additionalDirs,
    });
    hydrateSessionSnapshot(current);
    if (draftInteractionMode === 'multitask') {
      setSwarmModeEntry('manual');
      updateTimeline((entries) => appendSwarmMarker(entries, 'active'));
    }
    return current;
  }

  async function sendPromptNow(
    sessionId: string,
    text: string,
    nextAttachments: readonly PromptAttachment[],
    nextReferences: readonly PromptReference[],
  ): Promise<void> {
    const optimistic: TimelineEntry = {
      id: `user:${Date.now().toString()}`,
      kind: 'user',
      content:
        text ||
        [...nextAttachments.map((item) => item.name), ...nextReferences.map(referenceLabel)].join(', '),
    };
    updateTimeline((entries) => [...entries, optimistic]);
    await api.prompt({
      sessionId,
      text,
      attachments: nextAttachments,
      references: nextReferences,
    });
    setSession((value) =>
      value === undefined ? value : { ...value, status: { ...value.status, running: true } },
    );
    await Promise.all([refreshProjects(), refreshTasks(activeProject?.workDir)]);
  }

  async function dispatchQueuedHead(sessionId: string): Promise<void> {
    if (queueDispatchPendingRef.current || sending) return;
    const { next, item } = shiftQueuedComposerItem(composerQueueRef.current);
    if (item === undefined) return;
    queueDispatchPendingRef.current = true;
    setComposerQueue(next);
    try {
      setSending(true);
      await sendPromptNow(sessionId, item.text, item.attachments, item.references);
    } catch (cause) {
      setComposerQueue((current) => [item, ...current]);
      setError(messageOf(cause));
    } finally {
      setSending(false);
      queueDispatchPendingRef.current = false;
    }
  }

  async function submitPrompt(text = prompt): Promise<void> {
    const trimmed = text.trim();
    if (await runSlashCommand(trimmed)) {
      setPrompt('');
      return;
    }
    if (trimmed.length === 0 && attachments.length === 0 && references.length === 0) return;
    try {
      setSending(true);
      const current = await ensureActiveSession();
      if (current === undefined) return;
      const skillReferences = references.filter(
        (reference): reference is Extract<PromptReference, { readonly kind: 'skill' }> =>
          reference.kind === 'skill',
      );
      if (skillReferences.length > 0) {
        if (
          skillReferences.length !== 1 ||
          attachments.length > 0 ||
          references.some((reference) => reference.kind !== 'skill')
        ) {
          setError('一次只能激活一个 Skill，且不能同时附加文件、路径或历史任务。');
          return;
        }
        if (current.status.running) {
          setError('代理运行中时无法激活 Skill，请等待当前回合结束或先取消。');
          return;
        }
        const skill = skillReferences[0]!;
        updateTimeline((entries) => [
          ...entries,
          {
            id: `user:${Date.now().toString()}`,
            kind: 'user',
            content: `$${skill.name}${trimmed.length > 0 ? ` ${trimmed}` : ''}`,
          },
        ]);
        setPrompt('');
        setReferences([]);
        await api.activateSkill(current.id, skill.name, trimmed || undefined);
        setSession((value) =>
          value === undefined ? value : { ...value, status: { ...value.status, running: true } },
        );
        await Promise.all([refreshProjects(), refreshTasks(activeProject?.workDir)]);
        return;
      }
      const toSend = attachments;
      const referencesToSend = references;
      setPrompt('');
      setAttachments([]);
      setReferences([]);
      if (current.status.running) {
        setComposerQueue((queue) =>
          enqueueComposerItem(queue, {
            text: trimmed,
            attachments: toSend,
            references: referencesToSend,
          }),
        );
        return;
      }
      await sendPromptNow(current.id, trimmed, toSend, referencesToSend);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSending(false);
    }
  }

  async function steerPrompt(
    text = prompt,
    options?: {
      readonly attachments?: readonly PromptAttachment[];
      readonly references?: readonly PromptReference[];
      readonly clearComposer?: boolean;
    },
  ): Promise<void> {
    const current = session;
    if (current === undefined || !current.status.running) {
      await submitPrompt(text);
      return;
    }
    const trimmed = text.trim();
    const nextAttachments = options?.attachments ?? attachments;
    const nextReferences = options?.references ?? references;
    if (trimmed.length === 0 && nextAttachments.length === 0 && nextReferences.length === 0) return;
    try {
      if (options?.clearComposer !== false) {
        setPrompt('');
        setAttachments([]);
        setReferences([]);
      }
      await api.steer({
        sessionId: current.id,
        text: trimmed,
        attachments: nextAttachments,
        references: nextReferences,
      });
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  function editQueuedItem(item: QueuedComposerItem): void {
    setComposerQueue((queue) => removeQueuedComposerItem(queue, item.id));
    setPrompt(item.text);
    setAttachments(item.attachments);
    setReferences(item.references);
    focusComposerTextarea();
  }

  async function steerQueuedItem(item: QueuedComposerItem): Promise<void> {
    const current = session;
    if (current === undefined || !current.status.running) return;
    const taken = takeQueuedComposerItem(composerQueueRef.current, item.id);
    setComposerQueue(taken.next);
    if (taken.item === undefined) return;
    try {
      await api.steer({
        sessionId: current.id,
        text: taken.item.text,
        attachments: taken.item.attachments,
        references: taken.item.references,
      });
    } catch (cause) {
      setComposerQueue((queue) => [taken.item!, ...queue]);
      setError(messageOf(cause));
    }
  }

  async function changeRoute(next: Route): Promise<void> {
    if (isUtilityRoute(next)) {
      selectPanel(next);
      return;
    }
    setRoute(next);
    setPanel('none');
    if (next === 'new') await startNewTask();
    if (next === 'chat') await startNewTask('ask');
  }

  function focusComposerTextarea(): void {
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
    });
  }

  useEffect(() => {
    if (session === undefined || session.status.running || sending) return;
    if (queueDispatchPendingRef.current) return;
    if (composerQueue.length === 0) return;
    void dispatchQueuedHead(session.id);
  }, [session?.id, session?.status.running, sending, composerQueue.length]);

  async function pickAttachments(): Promise<void> {
    try {
      const next = await api.pickAttachments();
      if (next.length === 0) return;
      setAttachments((current) => mergeAttachments(current, next));
      focusComposerTextarea();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function attachFiles(files: readonly File[]): Promise<void> {
    if (files.length === 0) return;
    const attachable = files.filter(canAttachFile);
    if (attachable.length === 0) {
      setError('无法附加该文件，请使用 + 菜单选择本地文件');
      return;
    }
    if (attachable.length < files.length) {
      setError('部分文件无法附加，请使用 + 菜单选择本地文件');
    }
    try {
      const next = await Promise.all(attachable.map(fileToAttachment));
      setAttachments((current) => mergeAttachments(current, next));
      focusComposerTextarea();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  function attachBrowserAnnotation(annotation: BrowserAnnotation): void {
    const name = `${annotation.title} · ${annotation.selector}`.slice(0, 180);
    setAttachments((current) => [
      ...current.filter((attachment) => attachment.browserAnnotation?.id !== annotation.id),
      {
        kind: 'image',
        name,
        path: `browser-annotation:${annotation.id}`,
        dataUrl: annotation.screenshot,
        browserAnnotation: annotation,
      },
    ]);
    focusComposerTextarea();
  }

  async function applyPermissionMode(mode: 'manual' | 'auto' | 'yolo'): Promise<void> {
    setDraftPermission(mode);
    if (session === undefined) return;
    try {
      const status = await api.configureSession(session.id, { permission: mode });
      setSession((current) =>
        current === undefined ? current : { ...current, status },
      );
      setDraftPermission(status.permission);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function applyInteractionMode(
    mode: InteractionMode,
    options: { readonly entry?: SwarmModeEntry; readonly skipMarker?: boolean } = {},
  ): Promise<boolean> {
    if (session?.status.running === true) {
      setError('任务运行中无法切换工作模式，请先停止当前任务。');
      return false;
    }
    setDraftInteractionMode(mode);
    setRoute('new');
    if (session === undefined) {
      if (mode === 'multitask') setSwarmModeEntry(options.entry ?? 'manual');
      else setSwarmModeEntry(undefined);
      return true;
    }
    const status = await api.configureSession(session.id, { interactionMode: mode });
    setSession((current) =>
      current === undefined ? current : { ...current, status },
    );
    setDraftInteractionMode(status.interactionMode);
    if (mode === 'multitask') {
      setSwarmModeEntry(options.entry ?? 'manual');
      if (options.skipMarker !== true) {
        updateTimeline((entries) => appendSwarmMarker(entries, 'active'));
      }
    } else if (session.status.interactionMode === 'multitask') {
      setSwarmModeEntry(undefined);
      if (options.skipMarker !== true) {
        updateTimeline((entries) => appendSwarmMarker(entries, 'inactive'));
      }
    }
    return true;
  }

  function requestSwarmPermission(
    restoreText: string,
    onSelect: (choice: SwarmStartPermissionChoice) => Promise<void>,
  ): void {
    setSwarmPermission({ restoreText, onSelect });
  }

  async function handleSwarmCommand(args: string): Promise<void> {
    const promptText = args.trim();
    const mode =
      promptText.toLowerCase() === 'on'
        ? true
        : promptText.toLowerCase() === 'off'
          ? false
          : undefined;

    if (mode !== undefined || promptText.length === 0) {
      const enable = mode ?? (session?.status.interactionMode !== 'multitask' &&
        draftInteractionMode !== 'multitask');
    const permission = session?.status.permission ?? draftPermission;
    if (enable) {
        if (permission === 'manual') {
          requestSwarmPermission(promptText.length === 0 ? '/swarm' : `/swarm ${promptText}`, async (choice) => {
            if (choice === 'auto' || choice === 'yolo') {
              setDraftPermission(choice);
              if (session !== undefined) {
                const status = await api.configureSession(session.id, { permission: choice });
                setSession((current) =>
                  current === undefined ? current : { ...current, status },
                );
              }
            }
            await applyInteractionMode('multitask', { entry: 'manual' });
          });
          return;
        }
        await applyInteractionMode('multitask', { entry: 'manual' });
        return;
      }
      await applyInteractionMode('agent');
      return;
    }

    // /swarm <task>
    const permission = session?.status.permission ?? draftPermission;
    if (permission === 'manual') {
      requestSwarmPermission(`/swarm ${promptText}`, async (choice) => {
        if (choice === 'auto' || choice === 'yolo') {
          setDraftPermission(choice);
          if (session !== undefined) {
            const status = await api.configureSession(session.id, { permission: choice });
            setSession((current) =>
              current === undefined ? current : { ...current, status },
            );
          }
        }
        const ok = await applyInteractionMode('multitask', { entry: 'task' });
        if (ok) await submitPrompt(promptText);
      });
      return;
    }
    const ok = await applyInteractionMode('multitask', { entry: 'task' });
    if (ok) await submitPrompt(promptText);
  }

  async function forkTask(id: string, workDir?: string): Promise<void> {
    try {
      const snapshot = await api.forkSession(id, workDir);
      hydrateSessionSnapshot(snapshot);
      setRoute('new');
      await Promise.all([refreshProjects(), refreshTasks()]);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function runSlashCommand(text: string): Promise<boolean> {
    const slashHost: SlashCommandHost = {
      session,
      draftPermission,
      draftInteractionMode,
      bootVersion: boot?.version,
      workDir: activeProject?.workDir ?? session?.workDir,
      showError: setError,
      showNotice: (message) => {
        updateTimeline((entries) => [
          ...entries,
          {
            id: `status:${Date.now().toString()}`,
            kind: 'status',
            title: '提示',
            content: message,
          },
        ]);
      },
      applyPermissionMode,
      applyInteractionMode,
      openComposerMenu: setComposerMenuRequest,
      handleSwarmCommand,
      compactSession: (sessionId, instruction) => api.compactSession(sessionId, instruction),
      initSession: (sessionId) => api.initSession(sessionId),
      getSessionUsage: (sessionId) => api.getSessionUsage(sessionId),
      clearSessionPlan: (sessionId) => api.clearSessionPlan(sessionId),
      appendStatus: (title, content) => {
        updateTimeline((entries) => [
          ...entries,
          {
            id: `status:${Date.now().toString()}`,
            kind: 'status',
            title,
            content,
          },
        ]);
      },
    };
    try {
      if (await handleAlignedSlashCommand(slashHost, text)) return true;
    } catch (cause) {
      setError(messageOf(cause));
      return true;
    }

    const match = /^\/([a-z0-9][a-z0-9_:/.-]*)(?:\s+([\s\S]*))?$/iu.exec(text);
    const command = match?.[1]?.toLocaleLowerCase();
    const argument = match?.[2]?.trim() ?? '';
    if (command === undefined) return false;
    if (command === 'new') await startNewTask();
    else if (command === 'open') await chooseProject();
    else if (command === 'help') setCommandOpen(true);
    else if (command === 'settings') await changeRoute('settings');
    else if (command === 'skills') await changeRoute('plugins');
    else if (command === 'inbox') await changeRoute('inbox');
    else if (command === 'scheduled') await changeRoute('scheduled');
    else if (command === 'sites') await changeRoute('sites');
    else if (command === 'pulls') await changeRoute('pulls');
    else if (command === 'memory') await changeRoute('memory');
    else if (command === 'files' || command === 'review' || command === 'terminal' || command === 'browser' || command === 'summary' || command === 'agents') {
      setRoute('new');
      selectPanel(command);
    } else if (command === 'agent') await applyInteractionMode('agent');
    else if (command === 'engineering' || command === 'gongcheng') {
      await applyInteractionMode('engineering');
    }
    else if (command === 'chat') await applyInteractionMode('ask');
    else if (command === 'debug') await applyInteractionMode('debug');
    else if (command === 'multitask' || command === 'swarm') {
      await handleSwarmCommand(argument);
    }
    else if (command === 'title') {
      if (session === undefined) setError('请先打开一个任务。');
      else if (argument.length === 0) setRenameTarget({ id: session.id, title: session.title });
      else {
        await api.renameSession(session.id, argument);
        setSession((current) => current === undefined ? current : { ...current, title: argument });
        await refreshTasks();
      }
    } else if (command === 'fork') {
      if (session === undefined) setError('请先打开一个任务。');
      else await forkTask(session.id, session.workDir);
    } else {
      const skill = availableSkills.find(
        (item) => skillSlashCommand(item).toLocaleLowerCase() === command,
      );
      const pluginCommand = pluginCommands.find(
        (item) => `${item.pluginId}:${item.name}`.toLocaleLowerCase() === command,
      );
      if (skill === undefined && pluginCommand === undefined) return false;
      try {
        setSending(true);
        const current = await ensureActiveSession();
        if (current === undefined) return true;
        updateTimeline((entries) => [
          ...entries,
          {
            id: `user:${Date.now().toString()}`,
            kind: 'user',
            content: text,
          },
        ]);
        if (skill !== undefined) {
          await api.activateSkill(current.id, skill.name, argument || undefined);
        } else if (pluginCommand !== undefined) {
          await api.activatePluginCommand(
            current.id,
            pluginCommand.pluginId,
            pluginCommand.name,
            argument || undefined,
          );
        }
        setSession((value) =>
          value === undefined ? value : { ...value, status: { ...value.status, running: true } },
        );
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setSending(false);
      }
    }
    return true;
  }

  const commands: readonly DesktopCommand[] = [
    { slash: 'new', label: '新建任务', description: '在当前项目中开始新任务', icon: <Plus />, shortcut: '⌘N', onSelect: () => void runSlashCommand('/new') },
    { slash: 'open', label: '打开项目', description: '从磁盘选择工作目录', icon: <FolderOpen />, shortcut: '⌘O', onSelect: () => void runSlashCommand('/open') },
    { slash: 'help', label: '命令面板', description: '查看 Ganymede 可用命令', icon: <Command />, shortcut: '⌘K', onSelect: () => void runSlashCommand('/help') },
    { slash: 'permission', label: '权限模式', description: '选择手动 / Auto / YOLO', icon: <ShieldQuestion />, onSelect: () => void runSlashCommand('/permission') },
    { slash: 'auto', label: 'Auto 模式', description: '切换 Auto：自动执行所有操作（含高风险）', icon: <ShieldCheck />, onSelect: () => void runSlashCommand('/auto') },
    { slash: 'yolo', label: 'YOLO 模式', description: '切换 YOLO：AI 判断哪些操作需要批准', icon: <ShieldAlert />, onSelect: () => void runSlashCommand('/yolo') },
    { slash: 'yes', label: 'YOLO 模式', description: '/yolo 的别名', icon: <ShieldAlert />, onSelect: () => void runSlashCommand('/yes') },
    { slash: 'mode', label: '工作模式', description: '选择 agent / engineering / plan / debug / multitask / ask', icon: <SlidersHorizontal />, onSelect: () => void runSlashCommand('/mode') },
    { slash: 'model', label: '切换模型', description: '打开模型选择器', icon: <Sparkles />, onSelect: () => void runSlashCommand('/model') },
    { slash: 'plan', label: '计划模式', description: '切换计划模式，或 /plan clear 清除计划', icon: <ListTodo />, onSelect: () => void runSlashCommand('/plan') },
    { slash: 'compact', label: '压缩上下文', description: '压缩当前对话上下文，可附带保留指令', icon: <Sparkles />, onSelect: () => void runSlashCommand('/compact') },
    { slash: 'init', label: '初始化项目', description: '分析代码库并生成 AGENTS.md', icon: <FileCode2 />, onSelect: () => void runSlashCommand('/init') },
    { slash: 'status', label: '会话状态', description: '显示版本、模型、权限与上下文占用', icon: <Sparkles />, onSelect: () => void runSlashCommand('/status') },
    { slash: 'usage', label: '用量', description: '显示本会话 token 用量', icon: <Sparkles />, onSelect: () => void runSlashCommand('/usage') },
    { slash: 'settings', label: '设置', description: '模型、外观与本地环境', icon: <Settings />, shortcut: '⌘,', onSelect: () => void runSlashCommand('/settings') },
    { slash: 'skills', label: '技能与插件', description: '管理技能、插件和 MCP', icon: <WandSparkles />, onSelect: () => void runSlashCommand('/skills') },
    { slash: 'inbox', label: '收件箱', description: '查看自动化运行结果', icon: <Inbox />, onSelect: () => void runSlashCommand('/inbox') },
    { slash: 'scheduled', label: '已安排', description: '管理计划任务', icon: <Clock3 />, onSelect: () => void runSlashCommand('/scheduled') },
    { slash: 'sites', label: '本地站点', description: '预览与托管本地站点', icon: <Globe2 />, onSelect: () => void runSlashCommand('/sites') },
    { slash: 'pulls', label: '拉取请求', description: '查看当前项目的 PR', icon: <GitPullRequest />, onSelect: () => void runSlashCommand('/pulls') },
    { slash: 'memory', label: '记忆', description: '搜索项目记忆', icon: <Brain />, onSelect: () => void runSlashCommand('/memory') },
    { slash: 'files', label: '文件', description: '打开文件面板', icon: <FileText />, shortcut: '⌘P', onSelect: () => void runSlashCommand('/files') },
    { slash: 'review', label: '审查', description: '打开代码审查面板', icon: <FileDiff />, shortcut: '⌘⇧G', onSelect: () => void runSlashCommand('/review') },
    { slash: 'terminal', label: '终端', description: '切换底部终端', icon: <TerminalSquare />, shortcut: '⌘J', onSelect: () => void runSlashCommand('/terminal') },
    { slash: 'browser', label: '浏览器', description: '打开应用内浏览器', icon: <Globe2 />, shortcut: '⌘T', onSelect: () => void runSlashCommand('/browser') },
    { slash: 'summary', label: '任务摘要', description: '查看当前任务信息', icon: <Sparkles />, shortcut: '⌘⇧S', onSelect: () => void runSlashCommand('/summary') },
    { slash: 'agents', label: 'Agent 集群', description: '查看后台 Agent 与 Bash 任务（前台集群进度在主对话区）', icon: <Boxes />, shortcut: '⌘⇧A', onSelect: () => void runSlashCommand('/agents') },
    { slash: 'agent', label: '助理模式', description: '执行完整的软件开发任务', icon: <Bot />, onSelect: () => void runSlashCommand('/agent') },
    { slash: 'engineering', label: '工程模式', description: 'KimiCodeBoost 系统化软件开发工作流', icon: <Hammer />, onSelect: () => void runSlashCommand('/engineering') },
    { slash: 'chat', label: '聊天模式', description: '围绕当前项目讨论与问答', icon: <MessageCircle />, onSelect: () => void runSlashCommand('/chat') },
    { slash: 'debug', label: '排障模式', description: '聚焦诊断问题和失败', icon: <Bug />, onSelect: () => void runSlashCommand('/debug') },
    { slash: 'multitask', label: '集群模式', description: '并行处理多个子任务', icon: <Boxes />, onSelect: () => void runSlashCommand('/multitask') },
    { slash: 'swarm', label: '集群 /swarm', description: '切换集群模式，或 /swarm <任务> 一键启动', icon: <Boxes />, onSelect: () => void runSlashCommand('/swarm') },
    { slash: 'title', label: '重命名任务', description: '修改当前任务名称', icon: <FileText />, onSelect: () => void runSlashCommand('/title') },
    { slash: 'fork', label: '创建任务副本', description: '从当前上下文创建分支任务', icon: <Copy />, onSelect: () => void runSlashCommand('/fork') },
    ...availableSkills.map((skill) => ({
      slash: skillSlashCommand(skill),
      label: `Skill · ${skill.name}`,
      description: skill.description ?? '运行 Skill',
      icon: <WandSparkles />,
      onSelect: () => void runSlashCommand(`/${skillSlashCommand(skill)}`),
    })),
    ...pluginCommands.map((command) => ({
      slash: `${command.pluginId}:${command.name}`,
      label: `Plugin · ${command.name}`,
      description: command.description,
      icon: <Plug />,
      onSelect: () => void runSlashCommand(`/${command.pluginId}:${command.name}`),
    })),
  ];

  if (loading && boot === undefined) {
    return (
      <div className="splash">
        <GanymedeMark size={56} />
        <div className="splash-title">Ganymede Code</div>
        <LoaderCircle className="spin" size={20} />
      </div>
    );
  }

  const taskSurface = route === 'new' || route === 'chat';
  const emptyTask = taskSurface && (session === undefined || timeline.length === 0);
  const chatSurface = taskSurface && !emptyTask;
  const railContentOpen = panel !== 'none';
  const railContentWidth = panel === 'browser' ? browserPanelWidth : sidePanelWidth;
  const railWidth = RAIL_CHROME_WIDTH + (railContentOpen ? railContentWidth : 0);
  const terminalPlacement = panel === 'terminal'
    ? 'rail'
    : bottomTerminalOpen
      ? 'bottom'
      : null;

  return (
    <div
      className={`app-shell${sidebarOpen ? '' : ' sidebar-collapsed'}${workspacePanelDockOpen ? '' : ' rail-collapsed'}`}
      ref={appShellRef}
      style={
        {
          '--sidebar-width': `${String(sidebarWidth)}px`,
          '--rail-width': `${String(railWidth)}px`,
          '--rail-content-width': `${String(railContentWidth)}px`,
          '--rail-chrome-width': `${String(RAIL_CHROME_WIDTH)}px`,
          '--terminal-height': `${String(terminalHeight)}px`,
        } as CSSProperties
      }
    >
      {sidebarOpen ? (
        <WorkspaceSidebar
          route={route}
          projects={projects}
          archivedProjects={archivedProjects}
          tasks={tasks}
          activeProject={activeProject}
          activeSessionId={session?.id}
          activeSessionRunning={session?.status.running === true}
          onRoute={(next) => {
            void changeRoute(next);
          }}
          onProject={(project) => void selectProject(project)}
          onTask={(task) => void openTask(task)}
          onArchive={(task) => {
            void api.archiveSession(task.id).then(async () => {
              if (session?.id === task.id) await startNewTask();
              await refreshTasks(activeProject?.workDir);
            }).catch((cause) => setError(messageOf(cause)));
          }}
          onPin={(task) => {
            void api.pinSession(task.id, !task.pinned).then(() => refreshTasks(activeProject?.workDir));
          }}
          onRename={(task) => setRenameTarget({ id: task.id, title: task.title })}
          onFork={(task) => void forkTask(task.id, task.workDir)}
          onProjectNew={(project, nextTarget) => {
            void (async () => {
              await selectProject(project);
              setTarget(nextTarget);
              await startNewTask();
            })();
          }}
          onProjectPin={(project) => {
            void api.setProjectPinned(project.workDir, !project.pinned)
              .then(() => refreshProjects())
              .catch((cause) => setError(messageOf(cause)));
          }}
          onProjectTerminal={(project) => {
            void selectProject(project).then(() => selectPanel('terminal'));
          }}
          onProjectReveal={(project) => {
            void api.revealFile(project.workDir).catch((cause) => setError(messageOf(cause)));
          }}
          onProjectAddDir={(project) => {
            addProjectDirectory(
              project.workDir,
              session?.workDir === project.workDir ? session.id : undefined,
            );
          }}
          onProjectRemove={setRemoveProjectTarget}
          onProjectRestore={(project) => {
            void api.restoreProject(project.workDir)
              .then(async (restored) => {
                await refreshProjects();
                await selectProject(restored);
              })
              .catch((cause) => setError(messageOf(cause)));
          }}
          onOpenWorkspacePicker={(anchor) => setWorkspacePicker({ anchor })}
          onNew={() => void startNewTask()}
          onCommand={() => setCommandOpen(true)}
          onClose={() => setSidebarOpen(false)}
          onResizeStart={(clientX) => beginHorizontalResize(
            clientX,
            sidebarWidth,
            1,
            220,
            320,
            (value) => previewShellSize('--sidebar-width', value),
            setSidebarWidth,
            'ganymede.sidebarWidth',
          )}
          userName={boot?.userName ?? 'G'}
        />
      ) : null}
      {sidebarOpen ? (
        <button
          aria-label="关闭侧栏"
          className="workspace-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <main className="workspace">
        <TopBar
          project={activeProject}
          session={session}
          sidebarOpen={sidebarOpen}
          workspacePanelDockOpen={workspacePanelDockOpen}
          settings={settings}
          availableEditors={availableEditors}
          platform={boot?.platform}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
          onToggleWorkspacePanelDock={() => {
            setWorkspacePanelDockOpen((value) => !value);
          }}
          onCommand={() => setCommandOpen(true)}
          onCancel={() => {
            if (!session) return;
            setComposerQueue([]);
            queueDispatchPendingRef.current = false;
            void api.cancelSession(session.id);
          }}
          onOpenInEditor={(command) => {
            if (activeProject === undefined) return;
            void openPathInEditor(activeProject.workDir, command);
          }}
          onPreferEditor={(command) => {
            void preferEditor(command);
          }}
          onOpenProjectFinder={() => {
            if (activeProject === undefined) return;
            void api.openFileExternal(activeProject.workDir).catch((cause) => setError(messageOf(cause)));
          }}
          onOpenProjectTerminal={() => {
            if (activeProject === undefined) return;
            void api.openInTerminal(activeProject.workDir).catch((cause) => setError(messageOf(cause)));
          }}
          onSettings={(next) => {
            setSettings(next);
            applyTheme(next);
          }}
          onRequestIndexRiskConfirm={() => {
            if (activeProject === undefined) return;
            void activateIndexForProject(activeProject).catch((cause) => setError(messageOf(cause)));
          }}
        />

        <div className="workspace-chrome">
        <div className={`workspace-body${terminalPlacement === 'bottom' ? ' terminal-open' : ''}`}>
          <div className="workspace-stage">
          <div className="workspace-main">
          <section
            className={`primary-surface${emptyTask ? ' empty-surface' : ''}${chatSurface ? ' primary-surface--chat' : ''}`}
          >
            {route === 'settings' ? (
              <RoutePage
                route="settings"
                activeProject={activeProject}
                session={session}
                settings={settings}
                logFile={boot?.logFile}
                modelConfiguration={boot}
                inboxAutomationFilter={inboxAutomationFilter}
                onSettings={(next) => {
                  setSettings(next);
                  applyTheme(next);
                }}
                onModelConfiguration={(configuration) => {
                  setBoot((current) =>
                    current === undefined ? current : { ...current, ...configuration },
                  );
                  if (session === undefined) {
                    setDraftModel(configuration.defaultModel);
                    setDraftThinking(configuration.defaultThinking);
                  }
                }}
                onOpenTask={(id) => {
                  const task = tasks.find((item) => item.id === id);
                  if (task !== undefined) {
                    void openTask(task);
                    return;
                  }
                  void (async () => {
                    try {
                      setLoading(true);
                      const snapshot = await api.resumeSession(id);
                      hydrateSessionSnapshot(snapshot);
                      setRoute('new');
                    } catch (cause) {
                      setError(messageOf(cause));
                    } finally {
                      setLoading(false);
                    }
                  })();
                }}
                onViewInbox={(automationId) => {
                  setInboxAutomationFilter(automationId);
                  selectPanel('inbox');
                }}
                onOpenSettings={() => void changeRoute('settings')}
                onPreviewSite={(url) => {
                  setBrowserPreviewUrl(url);
                  selectPanel('browser');
                  void api.createBrowser(session?.id, url).catch((cause) => setError(messageOf(cause)));
                }}
                onError={setError}
                onProjectUpdated={(project) => {
                  setActiveProject(project);
                  setProjects((prev) =>
                    prev.map((item) => (item.workDir === project.workDir ? project : item)),
                  );
                }}
              />
            ) : route === 'new' || route === 'chat' ? (
              session === undefined || timeline.length === 0 ? (
                <Home
                  project={activeProject}
                  chat={route === 'chat'}
                />
              ) : (
                <>
                  <div className="timeline-stage">
                    <Timeline
                      key={session.id}
                      scrollContainerRef={timelineScrollRef}
                      entries={timeline}
                      running={session.status.running}
                      workDir={activeProject?.workDir}
                      planMode={session.status.planMode}
                      interactionMode={session.status.interactionMode}
                      swarms={swarmState.swarms}
                      agentSubagents={agentSubagents}
                      swarmRevision={swarmRevision}
                      pendingPlanReview={
                        approval !== undefined && isPlanReviewApproval(approval)
                          ? parsePlanReviewDisplay(approval.display)
                          : undefined
                      }
                      approvalToolCallId={
                        approval !== undefined && isPlanReviewApproval(approval)
                          ? approval.toolCallId
                          : undefined
                      }
                      requestedTurnId={requestedTurnId}
                      onRequestedTurnHandled={handleRequestedTurnHandled}
                      onPreviewFile={previewTimelineFile}
                      onOpenPlanPath={openPlanPathFromChat}
                      onOpenInEditor={openTimelinePathInEditor}
                      onOpenPlanInPanel={openPlanInPanel}
                    />
                    <ComposerQueueBar
                      items={composerQueue}
                      canSteer={session.status.running}
                      platform={boot?.platform}
                      onEdit={editQueuedItem}
                      onPromote={(id) =>
                        setComposerQueue((queue) => promoteQueuedComposerItem(queue, id))
                      }
                      onRemove={(id) =>
                        setComposerQueue((queue) => removeQueuedComposerItem(queue, id))
                      }
                      onSteer={(item) => void steerQueuedItem(item)}
                    />
                  </div>
                  {sessionTurns.length > 0 ? (
                    <TimelineTurnRail
                      turns={sessionTurns}
                      onScrollToTurn={scrollToTurn}
                    />
                  ) : null}
                </>
              )
            ) : null}
            {(route === 'new' || route === 'chat') && (
              <Composer
                value={prompt}
                onChange={setPrompt}
                attachments={attachments}
                references={references}
                onPickAttachments={() => void pickAttachments()}
                onAttachFiles={(files) => void attachFiles(files)}
                onRemoveAttachment={(path) =>
                  setAttachments((items) => items.filter((item) => item.path !== path))
                }
                onAddReference={(reference) => {
                  setReferences((current) => {
                    const key = referenceKey(reference);
                    return current.some((item) => referenceKey(item) === key)
                      ? current
                      : [...current, reference];
                  });
                }}
                onRemoveReference={(reference) =>
                  setReferences((current) => current.filter((item) => referenceKey(item) !== referenceKey(reference)))
                }
                onSubmit={(text) => void submitPrompt(text)}
                onSteer={(text) => void steerPrompt(text)}
                onCancel={() => {
                  if (!session) return;
                  setComposerQueue([]);
                  queueDispatchPendingRef.current = false;
                  childAgentRouterRef.current.markActiveCancelled();
                  bumpSwarmRevision();
                  void api.cancelSession(session.id);
                }}
                question={question}
                onResolveQuestion={(resolution) => {
                  void api.resolveQuestion(resolution);
                  setQuestion(undefined);
                }}
                debugVerification={debugVerification}
                onResolveDebugVerification={(resolution) => {
                  void api.resolveDebugVerification(resolution);
                  setDebugVerification(undefined);
                }}
                running={session?.status.running ?? false}
                sending={sending}
                model={session?.status.model ?? draftModel ?? boot?.defaultModel}
                thinking={session?.status.thinkingEffort ?? draftThinking ?? boot?.defaultThinking}
                models={boot?.models ?? []}
                permission={session?.status.permission ?? draftPermission}
                interactionMode={session?.status.interactionMode ?? draftInteractionMode}
                project={activeProject}
                projects={projects}
                tasks={referenceTasks}
                session={session}
                commands={commands}
                target={target}
                sshProfiles={settings?.sshProfiles ?? []}
                sshProfileId={sshProfileId}
                onTarget={(next, profileId) => {
                  setTarget(next);
                  setSshProfileId(profileId);
                }}
                onOpenWorkspacePicker={(anchor) => setWorkspacePicker({ anchor })}
                menuRequest={composerMenuRequest}
                onMenuRequestHandled={() => setComposerMenuRequest(undefined)}
                onConfigure={(config) => {
                  if (config.interactionMode !== undefined) {
                    if (config.interactionMode === 'multitask') {
                      void handleSwarmCommand('on');
                      return;
                    }
                    void applyInteractionMode(config.interactionMode);
                    return;
                  }
                  if (config.permission !== undefined) {
                    void applyPermissionMode(config.permission);
                    return;
                  }
                  if (session === undefined) {
                    if (config.model !== undefined) setDraftModel(config.model);
                    if (config.thinking !== undefined) setDraftThinking(config.thinking);
                    return;
                  }
                  void api.configureSession(session.id, config).then((status) => {
                    setSession((current) =>
                      current === undefined ? current : { ...current, status },
                    );
                    setDraftInteractionMode(status.interactionMode);
                    setDraftPermission(status.permission);
                  }).catch((cause) => setError(messageOf(cause)));
                }}
                swarmActive={childAgentRouterRef.current.hasActiveSwarm()}
                backgroundAgents={backgroundBadge.agents}
                backgroundTasks={backgroundBadge.tasks}
                todos={unifiedTodos.todos}
                todosFromPlan={unifiedTodos.fromPlan}
                onOpenPlanTodos={() => {
                  if (activePlanPath !== undefined) openPlanInPanel(activePlanPath);
                  else selectPanel('plans');
                }}
                planApproval={
                  approval !== undefined && isPlanReviewApproval(approval)
                    ? approval
                    : undefined
                }
                onResolvePlanApproval={resolvePlanApproval}
                editsSummaryTurn={editsSummaryTurn}
                onOpenReview={() => selectPanel('review')}
                onPreviewEditedFile={(relativePath) => {
                  if (activeProject === undefined) return;
                  void openWorkspacePreview(activeProject.workDir, relativePath);
                }}
                onEditsError={setError}
                platform={boot?.platform}
              />
            )}
          </section>
          </div>
          {workspacePanelDockOpen && terminalPlacement === 'bottom' ? (
            <SidePanel
              panel="terminal"
              project={activeProject}
              session={session}
              settings={settings}
              timeline={timeline}
              size={terminalHeight}
              onResizeStart={(clientY) => beginVerticalResize(
                clientY,
                terminalHeight,
                150,
                520,
                (value) => previewShellSize('--terminal-height', value),
                setTerminalHeight,
                'ganymede.terminalHeight',
              )}
              onClose={() => setBottomTerminalOpen(false)}
              onError={setError}
              onProjectUpdated={(project) => {
                setActiveProject(project);
                setProjects((prev) =>
                  prev.map((item) => (item.workDir === project.workDir ? project : item)),
                );
              }}
              onBrowserAnnotation={attachBrowserAnnotation}
              browserPreviewUrl={browserPreviewUrl}
              onBrowserPreviewUrlConsumed={() => setBrowserPreviewUrl(undefined)}
              onPreviewFile={previewTimelineFile}
              availableEditors={availableEditors}
              onOpenInEditor={(path, command) => {
                void openPathInEditor(resolveWorkspacePath(activeProject?.workDir, path), command);
              }}
              onPreferEditor={(command) => {
                void preferEditor(command);
              }}
              terminalChrome="bottom"
            />
          ) : null}
          <WorkspaceBottomBar
            project={activeProject}
            session={session}
            models={boot?.models ?? []}
            terminalOpen={bottomTerminalOpen}
            onToggleTerminal={() => setBottomTerminalOpen((value) => !value)}
          />
          </div>
        </div>
        </div>
      </main>

      {workspacePanelDockOpen ? (
        <WorkspaceRail
          panel={panel}
          inboxUnreadCount={inboxUnreadCount}
          onPanel={selectPanel}
          resizable={railContentOpen}
          header={railHeader?.node}
          headerMode={railHeader?.mode}
          onResizeStart={
            railContentOpen
              ? (clientX) => {
                  if (panel === 'browser') {
                    beginHorizontalResize(
                      clientX,
                      browserPanelWidth,
                      -1,
                      460,
                      960,
                      previewRailContentWidth,
                      setBrowserPanelWidth,
                      'ganymede.browserPanelWidth',
                    );
                    return;
                  }
                  beginHorizontalResize(
                    clientX,
                    sidePanelWidth,
                    -1,
                    330,
                    620,
                    previewRailContentWidth,
                    setSidePanelWidth,
                    'ganymede.sidePanelWidth',
                  );
                }
              : undefined
          }
        >
          <WorkspaceRailChromeProvider onHeader={setRailHeader}>
          {panel !== 'none' ? (
            isUtilityPanel(panel) ? (
              <div className="utility-rail-panel">
                <RoutePage
                  route={panel}
                  activeProject={activeProject}
                  session={session}
                  settings={settings}
                  logFile={boot?.logFile}
                  modelConfiguration={boot}
                  inboxAutomationFilter={inboxAutomationFilter}
                  onSettings={(next) => {
                    setSettings(next);
                    applyTheme(next);
                  }}
                  onModelConfiguration={(configuration) => {
                    setBoot((current) =>
                      current === undefined ? current : { ...current, ...configuration },
                    );
                    if (session === undefined) {
                      setDraftModel(configuration.defaultModel);
                      setDraftThinking(configuration.defaultThinking);
                    }
                  }}
                  onOpenTask={(id) => {
                    const task = tasks.find((item) => item.id === id);
                    if (task !== undefined) {
                      void openTask(task);
                      return;
                    }
                    void (async () => {
                      try {
                        setLoading(true);
                        const snapshot = await api.resumeSession(id);
                        hydrateSessionSnapshot(snapshot);
                        setRoute('new');
                        setPanel('none');
                      } catch (cause) {
                        setError(messageOf(cause));
                      } finally {
                        setLoading(false);
                      }
                    })();
                  }}
                  onViewInbox={(automationId) => {
                    setInboxAutomationFilter(automationId);
                    selectPanel('inbox');
                  }}
                  onOpenSettings={() => void changeRoute('settings')}
                  onPreviewSite={(url) => {
                    setBrowserPreviewUrl(url);
                    selectPanel('browser');
                    void api.createBrowser(session?.id, url).catch((cause) => setError(messageOf(cause)));
                  }}
                  onError={setError}
                  onProjectUpdated={(project) => {
                    setActiveProject(project);
                    setProjects((prev) =>
                      prev.map((item) => (item.workDir === project.workDir ? project : item)),
                    );
                  }}
                />
              </div>
            ) : (
            <SidePanel
              panel={panel}
              project={activeProject}
              session={session}
              settings={settings}
              timeline={timeline}
              size={railContentWidth}
              embedded
              onResizeStart={() => undefined}
              onClose={closeWorkspacePanel}
              onError={setError}
              onProjectUpdated={(project) => {
                setActiveProject(project);
                setProjects((prev) =>
                  prev.map((item) => (item.workDir === project.workDir ? project : item)),
                );
              }}
              onBrowserAnnotation={attachBrowserAnnotation}
              browserPreviewUrl={browserPreviewUrl}
              onBrowserPreviewUrlConsumed={() => setBrowserPreviewUrl(undefined)}
              onPreviewFile={previewTimelineFile}
              availableEditors={availableEditors}
              selectedPlanPath={selectedPlanPath}
              onSelectedPlanPathChange={setSelectedPlanPath}
              plansRefreshToken={plansRefreshToken}
              onOpenInEditor={(path, command) => {
                void openPathInEditor(resolveWorkspacePath(activeProject?.workDir, path), command);
              }}
              onPreferEditor={(command) => {
                void preferEditor(command);
              }}
              planApproval={
                approval !== undefined && isPlanReviewApproval(approval)
                  ? approval
                  : undefined
              }
              models={boot?.models ?? []}
              model={session?.status.model ?? draftModel ?? boot?.defaultModel}
              thinking={session?.status.thinkingEffort ?? draftThinking ?? boot?.defaultThinking}
              platform={boot?.platform}
              onConfigureModel={(config) => {
                if (session === undefined) {
                  if (config.model !== undefined) setDraftModel(config.model);
                  if (config.thinking !== undefined) setDraftThinking(config.thinking);
                  return;
                }
                void api.configureSession(session.id, config).then((status) => {
                  setSession((current) =>
                    current === undefined ? current : { ...current, status },
                  );
                }).catch((cause) => setError(messageOf(cause)));
              }}
              onResolvePlanApproval={resolvePlanApproval}
              terminalChrome="rail"
            />
            )
          ) : null}
          </WorkspaceRailChromeProvider>
        </WorkspaceRail>
      ) : null}

      {approval !== undefined && !isPlanReviewApproval(approval) ? (
        <ApprovalModal
          request={approval}
          onResolve={(resolution) => {
            void api.resolveApproval(resolution);
            setApproval(undefined);
          }}
        />
      ) : null}
      {swarmPermission !== undefined ? (
        <SwarmStartPermissionModal
          onCancel={() => {
            setPrompt(swarmPermission.restoreText);
            setSwarmPermission(undefined);
          }}
          onSelect={(choice) => {
            const pending = swarmPermission;
            setSwarmPermission(undefined);
            void pending.onSelect(choice).catch((cause) => setError(messageOf(cause)));
          }}
        />
      ) : null}
      {indexRiskPrompt !== undefined ? (
        <IndexRiskModal
          assessment={indexRiskPrompt.assessment}
          onCancel={() => {
            void api.deactivateProjectIndex(indexRiskPrompt.workDir).catch(() => undefined);
            setIndexRiskPrompt(undefined);
          }}
          onDisableIndex={() => {
            void api
              .setSettings({ indexEnabled: false })
              .then((next) => {
                setSettings(next);
                applyTheme(next);
                setIndexRiskPrompt(undefined);
              })
              .catch((cause) => setError(messageOf(cause)));
          }}
          onForceIndex={() => {
            const pending = indexRiskPrompt;
            setIndexRiskPrompt(undefined);
            void forceActivateProjectIndex(api, pending.workDir, pending.additionalDirs).catch(
              (cause) => setError(messageOf(cause)),
            );
          }}
          onOptOut={() => {
            const pending = indexRiskPrompt;
            setIndexRiskPrompt(undefined);
            void optOutProjectIndex(
              api,
              pending.assessment.root,
              settings?.indexOptOutRoots ?? [],
            )
              .then(async () => {
                const next = await api.getSettings();
                setSettings(next);
              })
              .catch((cause) => setError(messageOf(cause)));
          }}
        />
      ) : null}
      {commandOpen ? (
        <CommandPalette
          commands={commands}
          projects={projects}
          tasks={referenceTasks}
          onClose={() => setCommandOpen(false)}
          onTask={(task) => {
            void openTask(task);
            setCommandOpen(false);
          }}
        />
      ) : null}
      {renameTarget !== undefined ? (
        <RenameSheet
          initialValue={renameTarget.title}
          onClose={() => setRenameTarget(undefined)}
          onRename={(title) => {
            void api.renameSession(renameTarget.id, title)
              .then(async () => {
                if (session?.id === renameTarget.id) {
                  setSession((current) => current === undefined ? current : { ...current, title });
                }
                setRenameTarget(undefined);
                await refreshTasks();
              })
              .catch((cause) => setError(messageOf(cause)));
          }}
        />
      ) : null}
      {removeProjectTarget !== undefined ? (
        <ConfirmSheet
          body={`“${removeProjectTarget.name}”会移入归档列表，项目目录和历史任务不会被删除。可随时从「归档」恢复。`}
          confirmLabel="归档项目"
          danger
          onClose={() => setRemoveProjectTarget(undefined)}
          onConfirm={() => {
            void api.removeProject(removeProjectTarget.workDir)
              .then(async () => {
                if (activeProject?.workDir === removeProjectTarget.workDir) {
                  setActiveProject(undefined);
                  await startNewTask();
                }
                setRemoveProjectTarget(undefined);
                await refreshProjects();
              })
              .catch((cause) => setError(messageOf(cause)));
          }}
          title="归档项目？"
        />
      ) : null}
      {workspacePicker !== undefined ? (
        <WorkspacePickerPopover
          anchor={workspacePicker.anchor}
          items={buildWorkspacePickerItems({
            projects,
            activeProject,
            additionalDirs: session?.additionalDirs ?? activeProject?.additionalDirs,
            onSelectProject: (project) => void selectProject(project),
            onOpenFromDisk: () => void chooseProject(),
            onAddAdditionalDir: () => {
              if (activeProject === undefined) return;
              addProjectDirectory(activeProject.workDir, session?.id);
            },
          })}
          onClose={() => setWorkspacePicker(undefined)}
        />
      ) : null}
      {error !== undefined ? <Toast message={error} onClose={() => setError(undefined)} /> : null}
    </div>
  );
}

function TopBar(props: {
  readonly project?: ProjectSummary;
  readonly session?: SessionSnapshot;
  readonly sidebarOpen: boolean;
  readonly workspacePanelDockOpen: boolean;
  readonly settings?: AppSettings;
  readonly availableEditors: readonly EditorPresetView[];
  readonly platform?: NodeJS.Platform;
  readonly onToggleSidebar: () => void;
  readonly onToggleWorkspacePanelDock: () => void;
  readonly onCommand: () => void;
  readonly onCancel: () => void;
  readonly onOpenInEditor: (command: string) => void;
  readonly onPreferEditor: (command: string) => void;
  readonly onOpenProjectFinder: () => void;
  readonly onOpenProjectTerminal: () => void;
  readonly onSettings?: (settings: AppSettings) => void;
  readonly onRequestIndexRiskConfirm?: () => void;
}): ReactNode {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button aria-label="切换侧栏" className="icon-button" onClick={props.onToggleSidebar} title="切换侧栏 ⌘B">
          <PanelLeft size={16} className={props.sidebarOpen ? '' : 'flip'} />
        </button>
        {props.session !== undefined ? (
          <div className="breadcrumbs">
            <span>{props.session.title}</span>
            {props.project?.isGitRepository === true && props.project.branch !== undefined ? (
            <>
              <span className="slash">/</span>
              <GitBranch size={13} />
              <span>{props.project.branch}</span>
            </>
            ) : null}
          </div>
        ) : null}
        {props.project !== undefined && !props.project.isGitRepository ? (
          <span className="topbar-git-status" title="此项目不是 Git 仓库">
            <Folder size={11} />
            <span>非 Git</span>
          </span>
        ) : null}
        <TopbarIndexStatus
          additionalDirs={props.project?.additionalDirs}
          onRequestRiskConfirm={props.onRequestIndexRiskConfirm}
          onSettings={props.onSettings}
          workDir={props.project?.workDir}
        />
      </div>
      <div className="topbar-center">
        <EditorShortcuts
          workDir={props.project?.workDir}
          editorCommand={props.settings?.editorCommand}
          available={props.availableEditors}
          platform={props.platform}
          onOpen={props.onOpenInEditor}
          onPrefer={props.onPreferEditor}
          onOpenFinder={props.onOpenProjectFinder}
          onOpenTerminal={props.onOpenProjectTerminal}
        />
      </div>
      <div className="topbar-actions">
        {props.session?.status.running === true ? (
          <button aria-label="停止任务" className="icon-button danger" onClick={props.onCancel} title="停止任务">
            <CircleStop size={16} />
          </button>
        ) : null}
        <button
          aria-label="切换右侧栏"
          className={`icon-button${props.workspacePanelDockOpen ? ' active' : ''}`}
          onClick={props.onToggleWorkspacePanelDock}
          title="切换右侧栏 ⌘⌥B"
        >
          <PanelRight size={16} className={props.workspacePanelDockOpen ? '' : 'flip'} />
        </button>
        <button aria-label="命令面板" className="icon-button" onClick={props.onCommand} title="命令面板 ⌘K">
          <Command size={16} />
        </button>
      </div>
    </header>
  );
}

function Home(props: {
  readonly project?: ProjectSummary;
  readonly chat: boolean;
}): ReactNode {
  return (
    <div className="home">
      <h1>{props.chat ? '有什么想法，我们聊聊' : timeGreeting()}</h1>
      <p>{props.project === undefined ? '选择一个项目开始工作' : props.project.name}</p>
    </div>
  );
}

function useStableSessionTurns(
  entries: readonly TimelineEntry[],
  semanticRevision: string,
): readonly SessionTurn[] {
  const cache = useRef<{
    readonly entryCount: number;
    readonly semanticRevision: string;
    readonly turns: readonly SessionTurn[];
  }>({
    entryCount: -1,
    semanticRevision: '',
    turns: [],
  });
  if (
    cache.current.entryCount !== entries.length ||
    cache.current.semanticRevision !== semanticRevision
  ) {
    cache.current = {
      entryCount: entries.length,
      semanticRevision,
      turns: buildSessionTurns(entries),
    };
  }
  return cache.current.turns;
}

const Timeline = memo(function Timeline(props: {
  readonly entries: readonly TimelineEntry[];
  readonly running: boolean;
  readonly workDir?: string;
  readonly planMode?: boolean;
  readonly interactionMode?: InteractionMode;
  readonly swarms?: ReadonlyMap<string, SwarmProgressView>;
  readonly agentSubagents?: ReadonlyMap<string, AgentSubagentView>;
  readonly swarmRevision?: number;
  readonly pendingPlanReview?: ReturnType<typeof parsePlanReviewDisplay>;
  readonly approvalToolCallId?: string;
  readonly requestedTurnId?: string;
  readonly onRequestedTurnHandled?: () => void;
  readonly scrollContainerRef?: RefObject<HTMLDivElement | null>;
  readonly onPreviewFile?: (relativePath: string) => void;
  readonly onOpenPlanPath?: (path: string) => void;
  readonly onOpenInEditor?: (path: string) => void;
  readonly onOpenPlanInPanel?: (path?: string) => void;
}): ReactNode {
  const localContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = props.scrollContainerRef ?? localContainerRef;
  const pinnedRef = useRef(true);
  const previousLengthRef = useRef(0);
  const scrollFrameRef = useRef<number | undefined>(undefined);
  const historySentinelRef = useRef<HTMLDivElement>(null);
  const prependSnapshotRef = useRef<
    { readonly height: number; readonly top: number } | undefined
  >(undefined);
  const [visibleStart, setVisibleStart] = useState(() =>
    stagedTimelineWindowStart(props.entries.length),
  );
  const initialWindowStart = initialTimelineWindowStart(props.entries.length);
  const latestExitPlan = latestExitPlanEntry(props.entries);
  const visibleEntries = props.entries.slice(visibleStart);

  const scheduleScrollToBottom = useCallback(() => {
    if (scrollFrameRef.current !== undefined) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = undefined;
      const element = containerRef.current;
      if (element === null || !pinnedRef.current) return;
      scrollTimelineToBottom(element);
    });
  }, [containerRef]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== undefined) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (visibleStart <= initialWindowStart) return;
    const frame = window.requestAnimationFrame(() => {
      setVisibleStart((current) =>
        Math.max(initialWindowStart, current - TIMELINE_INITIAL_RENDER_SLICE));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialWindowStart, visibleStart]);

  const handleScroll = useCallback(() => {
    const element = containerRef.current;
    if (element === null) return;
    pinnedRef.current = isTimelineNearBottom(element);
  }, [containerRef]);

  useEffect(() => {
    const element = containerRef.current;
    const inner = element?.querySelector('.timeline-inner');
    if (element === null || !(inner instanceof HTMLElement)) return;

    const observer = new ResizeObserver(() => {
      if (!pinnedRef.current) return;
      scheduleScrollToBottom();
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [containerRef, scheduleScrollToBottom]);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;

    const previousLength = previousLengthRef.current;
    const currentLength = props.entries.length;
    const lastEntry = props.entries.at(-1);
    const shouldScroll = shouldTimelineAutoScroll({
      pinnedToBottom: pinnedRef.current,
      previousLength,
      currentLength,
      lastEntryKind: lastEntry?.kind,
    });
    previousLengthRef.current = currentLength;

    if (!shouldScroll) return;
    pinnedRef.current = true;
    scheduleScrollToBottom();
  }, [containerRef, props.entries, props.swarmRevision, scheduleScrollToBottom]);

  const loadOlder = useCallback(() => {
    if (visibleStart <= 0) return;
    const element = containerRef.current;
    if (element === null) return;
    prependSnapshotRef.current = {
      height: element.scrollHeight,
      top: element.scrollTop,
    };
    pinnedRef.current = false;
    setVisibleStart((current) => previousTimelineWindowStart(current));
  }, [containerRef, visibleStart]);

  useLayoutEffect(() => {
    const snapshot = prependSnapshotRef.current;
    const element = containerRef.current;
    if (snapshot === undefined || element === null) return;
    prependSnapshotRef.current = undefined;
    element.scrollTop = snapshot.top + (element.scrollHeight - snapshot.height);
  }, [containerRef, visibleStart]);

  useEffect(() => {
    const root = containerRef.current;
    const sentinel = historySentinelRef.current;
    if (visibleStart <= 0 || root === null || sentinel === null) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadOlder();
      },
      { root, rootMargin: '400px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [containerRef, loadOlder, visibleStart]);

  useEffect(() => {
    const requestedTurnId = props.requestedTurnId;
    if (requestedTurnId === undefined) return;
    const index = props.entries.findIndex((entry) => entry.id === requestedTurnId);
    if (index < 0) {
      props.onRequestedTurnHandled?.();
      return;
    }
    const nextStart = timelineWindowStartForIndex(index, visibleStart);
    if (nextStart !== visibleStart) {
      setVisibleStart(nextStart);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const element = containerRef.current;
      const target = document.getElementById(turnAnchorId(requestedTurnId));
      if (element !== null && target !== null) {
        pinnedRef.current = false;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        scrollTimelineToElement(element, target, {
          behavior: reducedMotion ? 'auto' : 'smooth',
          offset: 12,
        });
      }
      props.onRequestedTurnHandled?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    containerRef,
    props.entries,
    props.onRequestedTurnHandled,
    props.requestedTurnId,
    visibleStart,
  ]);

  return (
    <div className="timeline" ref={containerRef} onScroll={handleScroll}>
      <div className="timeline-inner">
        {visibleStart > 0 ? (
          <div className="timeline-history-sentinel" ref={historySentinelRef}>
            <button type="button" onClick={loadOlder}>加载更早记录</button>
          </div>
        ) : null}
        {visibleEntries.map((entry) => (
          <div className={`timeline-entry timeline-entry--${entry.kind}`} key={entry.id}>
            <TimelineBlock
              entry={entry}
              workDir={props.workDir}
              planMode={props.planMode}
              interactionMode={props.interactionMode}
              pendingPlanReview={pendingPlanReviewForTimelineEntry(
                entry,
                props.pendingPlanReview,
                props.approvalToolCallId,
                latestExitPlan?.id === entry.id,
              )}
              showPlanHint={latestExitPlan?.id === entry.id}
              swarm={
                entry.kind === 'tool' && entry.title === 'AgentSwarm' && entry.toolCallId !== undefined
                  ? props.swarms?.get(entry.toolCallId)
                  : undefined
              }
              subagent={
                entry.kind === 'tool' && entry.title === 'Agent' && entry.toolCallId !== undefined
                  ? props.agentSubagents?.get(entry.toolCallId)
                  : undefined
              }
              onPreviewFile={props.onPreviewFile}
              onOpenPlanPath={props.onOpenPlanPath}
              onOpenInEditor={props.onOpenInEditor}
              onOpenPlanInPanel={props.onOpenPlanInPanel}
            />
          </div>
        ))}
        {props.running ? (
          <div className="working-row">
            <span className="orb-loader"><i /><i /><i /></span>
            <span>Ganymede 正在推进任务</span>
          </div>
        ) : null}
      </div>
    </div>
  );
});

const TimelineBlock = memo(function TimelineBlock(props: {
  readonly entry: TimelineEntry;
  readonly workDir?: string;
  readonly planMode?: boolean;
  readonly interactionMode?: InteractionMode;
  readonly swarm?: SwarmProgressView;
  readonly subagent?: AgentSubagentView;
  readonly pendingPlanReview?: ReturnType<typeof parsePlanReviewDisplay>;
  readonly showPlanHint?: boolean;
  readonly onPreviewFile?: (relativePath: string) => void;
  readonly onOpenPlanPath?: (path: string) => void;
  readonly onOpenInEditor?: (path: string) => void;
  readonly onOpenPlanInPanel?: (path?: string) => void;
}): ReactNode {
  const { entry } = props;
  if (entry.kind === 'user') {
    return (
      <div className="message user-message" id={turnAnchorId(entry.id)}>
        {entry.content}
      </div>
    );
  }
  if (entry.kind === 'assistant') {
    if (
      shouldSuppressPlanAssistantStream({
        interactionMode: props.interactionMode,
        planMode: props.planMode,
        streaming: entry.streaming,
      })
    ) {
      return <div className="plan-writing-hint">正在撰写计划…</div>;
    }
    return (
      <StreamingAssistantMessage
        content={entry.content}
        streaming={entry.streaming === true}
        workDir={props.workDir}
        onPreviewFile={props.onPreviewFile}
        onOpenPlanPath={props.onOpenPlanPath}
        onOpenExternal={openExternalFromTimeline}
      />
    );
  }
  if (entry.kind === 'thinking') {
    const thinkingStreaming = entry.streaming === true;
    return (
      <details
        className={`thinking-block${thinkingStreaming ? ' is-streaming' : ''}`}
        open={thinkingStreaming ? true : undefined}
      >
        <summary><Brain size={14} /> 思考过程</summary>
        <StreamingThinkingBody content={entry.content} streaming={thinkingStreaming} />
      </details>
    );
  }
  if (entry.kind === 'swarm-marker') {
    return (
      <div className={`swarm-marker ${entry.swarmMarker ?? 'active'}`}>
        <Boxes size={14} />
        <span>{entry.title ?? '集群模式'}</span>
      </div>
    );
  }
  if (entry.kind === 'tool' && entry.title === 'ExitPlanMode') {
    if (props.showPlanHint !== true) return null;
    return (
      <PlanBoxView
        entry={entry}
        pendingReview={props.pendingPlanReview}
        onOpenInPanel={props.onOpenPlanInPanel}
      />
    );
  }
  if (entry.kind === 'tool' && entry.title === 'AgentSwarm') {
    if (props.swarm !== undefined) {
      return <AgentSwarmProgressView swarm={props.swarm} />;
    }
    return (
      <details className={`tool-block agent-swarm-progress${entry.error ? ' error' : ''}`}>
        <summary>
          <Bot size={14} />
          <strong>AgentSwarm</strong>
          <span className={`tool-status ${entry.error ? 'failed' : 'completed'}`}>
            {entry.error ? '失败' : entry.content || '完成'}
          </span>
          <ChevronDown size={14} />
        </summary>
        {entry.content.length > 0 ? (
          <div className="agent-swarm-body">
            <div className="agent-swarm-summary">{entry.content}</div>
          </div>
        ) : null}
      </details>
    );
  }
  if (entry.kind === 'tool') {
    return (
      <ToolBlockView
        entry={entry}
        workDir={props.workDir}
        subagent={props.subagent}
        onPreviewFile={props.onPreviewFile}
        onOpenInEditor={props.onOpenInEditor}
      />
    );
  }
  return (
    <div className={`status-block ${entry.kind}`}>
      {entry.kind === 'error' ? <X size={14} /> : entry.kind === 'subagent' ? <Bot size={14} /> : <Sparkles size={14} />}
      <span>{entry.title ?? entry.content}</span>
      {entry.title !== undefined && entry.content.length > 0 ? <small>{entry.content}</small> : null}
    </div>
  );
});

function Composer(props: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly attachments: readonly PromptAttachment[];
  readonly references: readonly PromptReference[];
  readonly onPickAttachments: () => void;
  readonly onAttachFiles: (files: readonly File[]) => void;
  readonly onRemoveAttachment: (path: string) => void;
  readonly onAddReference: (reference: PromptReference) => void;
  readonly onRemoveReference: (reference: PromptReference) => void;
  readonly onSubmit: (text?: string) => void;
  readonly onSteer: (text?: string) => void;
  readonly onCancel: () => void;
  readonly running: boolean;
  readonly sending: boolean;
  readonly model?: string;
  readonly thinking?: string;
  readonly models: readonly ModelOption[];
  readonly permission: 'manual' | 'auto' | 'yolo';
  readonly interactionMode: InteractionMode;
  readonly project?: ProjectSummary;
  readonly projects: readonly ProjectSummary[];
  readonly tasks: readonly TaskSummary[];
  readonly session?: SessionSnapshot;
  readonly commands: readonly DesktopCommand[];
  readonly target: 'local' | 'worktree' | 'ssh';
  readonly sshProfiles: AppSettings['sshProfiles'];
  readonly sshProfileId?: string;
  readonly onTarget: (target: 'local' | 'worktree' | 'ssh', profileId?: string) => void;
  readonly onOpenWorkspacePicker: (anchor: MenuAnchor) => void;
  readonly onConfigure: (config: SessionConfigurationInput) => void;
  readonly menuRequest?: ComposerMenuKind;
  readonly onMenuRequestHandled?: () => void;
  readonly swarmActive?: boolean;
  readonly backgroundAgents?: number;
  readonly backgroundTasks?: number;
  readonly todos?: readonly TodoItem[];
  readonly todosFromPlan?: boolean;
  readonly onOpenPlanTodos?: () => void;
  readonly planApproval?: PendingApproval;
  readonly onResolvePlanApproval?: (resolution: ApprovalResolution) => void;
  readonly question?: PendingQuestion;
  readonly onResolveQuestion?: (resolution: QuestionResolution) => void;
  readonly debugVerification?: PendingDebugVerification;
  readonly onResolveDebugVerification?: (resolution: DebugVerificationResolution) => void;
  readonly editsSummaryTurn?: ReturnType<typeof latestCompletedTurnWithEdits>;
  readonly onOpenReview?: () => void;
  readonly onPreviewEditedFile?: (relativePath: string) => void;
  readonly onEditsError?: (message: string) => void;
  readonly platform?: NodeJS.Platform;
}): ReactNode {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const permissionButton = useRef<HTMLButtonElement>(null);
  const modeButton = useRef<HTMLButtonElement>(null);
  const modelButton = useRef<HTMLButtonElement>(null);
  const dragDepth = useRef(0);
  const [menu, setMenu] = useState<{
    readonly kind: 'plus' | 'permission' | 'target' | 'model' | 'mode';
    readonly anchor: MenuAnchor;
  }>();
  const [trigger, setTrigger] = useState<TriggerContext>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [paths, setPaths] = useState<readonly PathSuggestion[]>([]);
  const [skills, setSkills] = useState<readonly SkillView[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [contextUsageOpen, setContextUsageOpen] = useState<{
    readonly anchor: MenuAnchor;
  }>();
  const [contextUsage, setContextUsage] = useState<ContextUsageSnapshot>();
  const [contextUsageLoading, setContextUsageLoading] = useState(false);
  const [indexContextPreview, setIndexContextPreview] = useState<IndexContextPreview>();
  const [indexContextLoading, setIndexContextLoading] = useState(false);
  const codebaseReferenceKey = props.references
    .filter((reference): reference is Extract<PromptReference, { readonly kind: 'codebase' }> =>
      reference.kind === 'codebase')
    .map((reference) => `${reference.query}:${String(reference.limit ?? 8)}`)
    .join('|');
  const contextTokens = props.session?.status.contextTokens ?? 0;
  const maxContextTokens = props.session?.status.maxContextTokens ?? 0;
  const contextRingAvailable = props.session !== undefined && maxContextTokens > 0;
  const contextDisplay = resolveContextUsageDisplay({
    contextTokens,
    maxContextTokens,
    categories: contextUsage?.categories,
  });
  const sessionIndexTokens = estimateTokensFromCharCount(
    estimateReplayIndexContextChars(props.session?.replay ?? []),
  );

  const syncTriggerFromCaret = (): void => {
    const element = textarea.current;
    if (element === null) return;
    setTrigger(composerTriggerAt(element.value, element.selectionStart));
  };

  useEffect(() => {
    if (props.menuRequest === undefined) return;
    const button =
      props.menuRequest === 'permission'
        ? permissionButton.current
        : props.menuRequest === 'mode'
          ? modeButton.current
          : modelButton.current;
    if (button !== null && button !== undefined) {
      setMenu({ kind: props.menuRequest, anchor: anchorFromElement(button) });
    }
    props.onMenuRequestHandled?.();
  }, [props.menuRequest, props.onMenuRequestHandled]);

  useEffect(() => {
    if (textarea.current === null) return;
    textarea.current.style.height = 'auto';
    textarea.current.style.height = `${String(Math.min(textarea.current.scrollHeight, 180))}px`;
  }, [props.value]);

  useEffect(() => {
    if (!contextRingAvailable || props.session === undefined) return;
    let alive = true;
    if (contextUsageOpen !== undefined) setContextUsageLoading(true);
    void api
      .contextUsageSnapshot({ sessionId: props.session.id })
      .then((snapshot) => {
        if (alive) setContextUsage(snapshot);
      })
      .catch(() => {
        if (alive) setContextUsage(undefined);
      })
      .finally(() => {
        if (alive) setContextUsageLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [
    contextRingAvailable,
    contextUsageOpen,
    props.session?.id,
    props.session?.status.contextTokens,
    props.session?.status.maxContextTokens,
  ]);

  useEffect(() => {
    if (props.session === undefined) {
      setContextUsageOpen(undefined);
      setContextUsage(undefined);
      setIndexContextPreview(undefined);
    }
  }, [props.session?.id]);

  useEffect(() => {
    if (contextUsageOpen === undefined) {
      setIndexContextPreview(undefined);
      setIndexContextLoading(false);
      return;
    }
    const project = props.project;
    if (project === undefined || codebaseReferenceKey.length === 0) {
      setIndexContextPreview(undefined);
      setIndexContextLoading(false);
      return;
    }
    let alive = true;
    setIndexContextLoading(true);
    const additionalDirs = props.session?.additionalDirs ?? project.additionalDirs;
    const references = props.references.filter(
      (reference): reference is Extract<PromptReference, { readonly kind: 'codebase' }> =>
        reference.kind === 'codebase',
    );
    const timer = window.setTimeout(() => {
      void api
        .previewIndexContext({
          workDir: project.workDir,
          additionalDirs,
          references,
        })
        .then((preview) => {
          if (alive) setIndexContextPreview(preview);
        })
        .catch(() => {
          if (alive) setIndexContextPreview(undefined);
        })
        .finally(() => {
          if (alive) setIndexContextLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [
    props.project?.workDir,
    props.project?.additionalDirs,
    props.session?.additionalDirs,
    codebaseReferenceKey,
    props.references,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [trigger?.trigger, trigger?.query]);

  useEffect(() => {
    if (trigger?.trigger !== '@' || props.project === undefined) {
      setPaths([]);
      return;
    }
    let alive = true;
    const roots = [
      props.project.workDir,
      ...(props.session?.additionalDirs ?? props.project.additionalDirs),
    ];
    void Promise.all(roots.map((root) => api.searchWorkspacePaths(root, trigger.query)))
      .then((groups) => {
        if (!alive) return;
        const seen = new Set<string>();
        setPaths(groups.flat().filter((item) => {
          const key = `${item.root}:${item.path}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 80));
      })
      .catch(() => {
        if (alive) setPaths([]);
      });
    return () => { alive = false; };
  }, [trigger?.trigger, trigger?.query, props.project?.workDir, props.session?.additionalDirs]);

  useEffect(() => {
    if (trigger?.trigger !== '$') return;
    let alive = true;
    void api.listSkills(props.session?.id, props.project?.workDir)
      .then((items) => { if (alive) setSkills(items); })
      .catch(() => { if (alive) setSkills([]); });
    return () => { alive = false; };
  }, [trigger?.trigger, props.session?.id, props.project?.workDir]);

  const focusAt = (value: string, cursor: number): void => {
    props.onChange(value);
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(cursor, cursor);
    });
  };

  const insertTrigger = (nextTrigger: ComposerTrigger): void => {
    const cursor = textarea.current?.selectionStart ?? props.value.length;
    const before = props.value.slice(0, cursor);
    const after = props.value.slice(cursor);
    const prefix = before.length > 0 && !/[\s([{]$/u.test(before) ? ' ' : '';
    const next = `${before}${prefix}${nextTrigger}${after}`;
    const nextCursor = cursor + prefix.length + 1;
    focusAt(next, nextCursor);
    setTrigger({ trigger: nextTrigger, query: '', start: nextCursor - 1, end: nextCursor });
  };

  const clearTrigger = (): void => {
    if (trigger !== undefined) {
      const next = removeComposerTrigger(props.value, trigger);
      focusAt(next, trigger.start);
    }
    setTrigger(undefined);
  };

  const selectReference = (reference: PromptReference): void => {
    props.onAddReference(reference);
    clearTrigger();
  };

  const selectCommand = (command: DesktopCommand): void => {
    if (trigger === undefined) return;
    const replacement = `/${command.slash}`;
    const next = `${props.value.slice(0, trigger.start)}${replacement}${props.value.slice(trigger.end)}`;
    focusAt(next, trigger.start + replacement.length);
    setTrigger(undefined);
  };

  const codebaseQuery = trigger?.trigger === '@' ? trigger.query.replace(/^codebase\s*/i, '').trim() : '';
  const showCodebaseSuggestion =
    trigger?.trigger === '@' &&
    props.project !== undefined &&
    (trigger.query.trim().length === 0 ||
      'codebase'.startsWith(trigger.query.trim().toLocaleLowerCase()) ||
      trigger.query.trim().toLocaleLowerCase().startsWith('codebase'));
  const suggestions: readonly ComposerSuggestion[] = trigger === undefined
    ? []
    : trigger.trigger === '@'
      ? [
          ...(showCodebaseSuggestion
            ? [{
                id: 'codebase',
                label: codebaseQuery.length > 0 ? `@codebase ${codebaseQuery}` : '@codebase',
                detail: '搜索整个代码库并注入相关片段',
                icon: <Search size={14} />,
                onSelect: () => selectReference({
                  kind: 'codebase',
                  query: codebaseQuery.length > 0 ? codebaseQuery : (props.value.trim() || 'project overview'),
                }),
              } satisfies ComposerSuggestion]
            : []),
          ...paths.map((item) => ({
            id: `${item.root}:${item.path}`,
            label: item.path,
            detail: item.root === props.project?.workDir ? props.project.name : item.root.split('/').at(-1),
            icon: item.kind === 'directory' ? <Folder size={14} /> : <FileText size={14} />,
            onSelect: () => selectReference({
              kind: 'path',
              root: item.root,
              path: item.path,
              name: item.name,
              pathKind: item.kind,
            }),
          })),
        ]
      : trigger.trigger === '$'
        ? skills
            .filter((skill) => skill.userActivatable)
            .filter((skill) => fuzzyTextMatch(`${skill.name} ${skill.description ?? ''}`, trigger.query))
            .map((skill) => ({
              id: skill.name,
              label: `$${skill.name}`,
              detail: skill.description,
              icon: <WandSparkles size={14} />,
              onSelect: () => selectReference({ kind: 'skill', name: skill.name }),
            }))
        : trigger.trigger === '#'
          ? props.tasks
              .filter((task) => task.id !== props.session?.id)
              .filter((task) => fuzzyTextMatch(`${task.title} ${task.lastPrompt ?? ''}`, trigger.query))
              .slice(0, 30)
              .map((task) => ({
                id: task.id,
                label: task.title,
                detail: props.projects.find((project) => project.workDir === task.workDir)?.name ?? task.workDir,
                icon: <Hash size={14} />,
                disabled: props.references.filter((item) => item.kind === 'session').length >= 3,
                onSelect: () => selectReference({ kind: 'session', sessionId: task.id, title: task.title }),
              }))
          : props.commands
              .filter((command) => fuzzyTextMatch(`${command.slash} ${command.label} ${command.description}`, trigger.query))
              .map((command) => ({
                id: command.slash,
                label: `/${command.slash}`,
                detail: command.description,
                icon: command.icon,
                onSelect: () => selectCommand(command),
              }));

  const visibleSuggestions = suggestions.slice(0, 12);
  const activeSuggestion = visibleSuggestions[Math.min(selectedIndex, Math.max(0, visibleSuggestions.length - 1))];
  const modeChildren = interactionModeMenuItems(props.interactionMode, props.onConfigure, props.running);
  const plusItems: readonly AppMenuItem[] = [
    { id: 'attachment', label: '添加附件', icon: <Paperclip />, onSelect: props.onPickAttachments },
    { id: 'mention', label: '插入 @ 提及', icon: <AtSign />, onSelect: () => insertTrigger('@') },
    { id: 'command', label: '插入 / 命令', icon: <TerminalSquare />, onSelect: () => insertTrigger('/') },
    { id: 'skill', label: '插入 $ 技能', icon: <WandSparkles />, onSelect: () => insertTrigger('$') },
    { id: 'session', label: '插入 # 会话', icon: <Hash />, onSelect: () => insertTrigger('#') },
    { id: 'composer-separator', separator: true },
    { id: 'mode', label: '工作模式', description: INTERACTION_MODE_LABELS[props.interactionMode], icon: <SlidersHorizontal />, children: modeChildren },
  ];
  const permissionItems = permissionMenuItems(props.permission, props.onConfigure);
  const targetItems = targetMenuItems(props.target, props.sshProfileId, props.sshProfiles, props.onTarget);
  const modelItems = modelMenuItems(
    props.model,
    props.thinking,
    props.models,
    props.onConfigure,
  );
  const activeMenuItems = menu?.kind === 'plus'
    ? plusItems
    : menu?.kind === 'permission'
      ? permissionItems
      : menu?.kind === 'target'
        ? targetItems
        : menu?.kind === 'mode'
          ? modeChildren
          : modelItems;
  const suggestionEmptyMessage =
    trigger?.trigger === '@' && props.project === undefined
      ? '请先选择项目'
      : undefined;
  const steerShortcut = props.platform === 'darwin' ? '⌘↵' : 'Ctrl+Enter';
  const modelFullLabel = modelLabel(props.model, props.thinking, props.models);
  const modelThinkingEffort =
    props.thinking
    ?? props.models.find((candidate) => candidate.id === props.model)?.defaultThinking;
  const targetToolbarLabel = targetLabel(props.target, props.sshProfileId, props.sshProfiles);
  const modeHint = composerModeHint(props.interactionMode, {
    running: props.running,
    planApprovalPending: props.planApproval !== undefined,
  });
  return (
    <div className="composer-dock">
      {props.question !== undefined && props.onResolveQuestion !== undefined ? (
        <QuestionBar request={props.question} onResolve={props.onResolveQuestion} />
      ) : null}
      {props.todos !== undefined && !shouldHideTodoBar(props.todos) ? (
        <ComposerTodoBar
          todos={props.todos}
          fromPlan={props.todosFromPlan}
          onOpenPlan={props.onOpenPlanTodos}
        />
      ) : null}
      {props.debugVerification !== undefined && props.onResolveDebugVerification !== undefined ? (
        <DebugVerificationBar
          request={props.debugVerification}
          onResolve={props.onResolveDebugVerification}
        />
      ) : null}
      {props.planApproval !== undefined && props.onResolvePlanApproval !== undefined ? (
        <div className="composer-plan-build-bar">
          <PlanBuildControls
            variant="dock"
            request={props.planApproval}
            models={props.models}
            model={props.model}
            thinking={props.thinking}
            platform={props.platform}
            onConfigureModel={props.onConfigure}
            onResolve={props.onResolvePlanApproval}
          />
        </div>
      ) : null}
      {modeHint ? (
        <div className={`composer-mode-hint ${interactionModeClassName(props.interactionMode)}`}>
          {modeHint}
        </div>
      ) : null}
      {props.editsSummaryTurn !== undefined
        && !props.running
        && props.onOpenReview !== undefined
        && props.onEditsError !== undefined ? (
        <TurnEditsSummaryBar
          turn={props.editsSummaryTurn}
          workDir={props.project?.workDir}
          isGitRepository={props.project?.isGitRepository}
          onOpenReview={props.onOpenReview}
          onPreviewFile={props.onPreviewEditedFile}
          onError={props.onEditsError}
        />
      ) : null}
      <div
        className={`composer${props.running ? ' running' : ''} mode-${props.interactionMode}${dragOver ? ' composer-drag-over' : ''}`}
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          dragDepth.current += 1;
          setDragOver(true);
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragOver(false);
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          dragDepth.current = 0;
          setDragOver(false);
          props.onAttachFiles(filesFromDataTransfer(event.dataTransfer));
        }}
      >
        <div className="composer-context">
          <button
            className="composer-project"
            onClick={(event) => props.onOpenWorkspacePicker(anchorFromElement(event.currentTarget))}
          >
            <Folder size={14} /> {props.project?.name ?? '选择项目'} <ChevronDown size={12} />
          </button>
          {(props.session?.additionalDirs ?? props.project?.additionalDirs ?? []).map((dir) => (
            <span className="extra-context" key={dir}><Plus size={11} /> {dir.split('/').at(-1)}</span>
          ))}
        </div>
        {props.attachments.length > 0 || props.references.length > 0 ? (
          <div className="attachment-row">
            {props.attachments.map((attachment) => (
              <span
                key={attachment.path}
                className={`attachment-chip${attachment.browserAnnotation !== undefined ? ' browser-element-attachment' : ''}`}
                title={attachment.browserAnnotation === undefined ? attachment.name : `${attachment.browserAnnotation.selector}\n${attachment.browserAnnotation.text}`}
              >
                {attachment.browserAnnotation !== undefined ? (
                  <>
                    <img alt="页面元素截图" src={attachment.browserAnnotation.screenshot} />
                    <span className="browser-element-copy">
                      <strong>{attachment.browserAnnotation.selector}</strong>
                      <small>{attachment.browserAnnotation.text || attachment.browserAnnotation.title}</small>
                    </span>
                  </>
                ) : (
                  <>{attachment.kind === 'image' ? <Sparkles size={12} /> : <FileText size={12} />}{attachment.name}</>
                )}
                <button aria-label={`移除附件 ${attachment.name}`} onClick={() => props.onRemoveAttachment(attachment.path)} title="移除附件"><X size={11} /></button>
              </span>
            ))}
            {props.references.map((reference) => (
              <span key={referenceKey(reference)} className={`attachment-chip reference-${reference.kind}`}>
                {referenceIcon(reference)}
                {referenceLabel(reference)}
                <button aria-label={`移除 ${referenceLabel(reference)}`} onClick={() => props.onRemoveReference(reference)} title="移除引用"><X size={11} /></button>
              </span>
            ))}
          </div>
        ) : null}
        <textarea
          ref={textarea}
          value={props.value}
          onChange={(event) => {
            props.onChange(event.target.value);
            setTrigger(composerTriggerAt(event.target.value, event.target.selectionStart));
          }}
          onClick={syncTriggerFromCaret}
          onKeyUp={syncTriggerFromCaret}
          onSelect={syncTriggerFromCaret}
          onPaste={(event) => {
            const images = imageFilesFromClipboard(event.clipboardData);
            if (images.length === 0) return;
            event.preventDefault();
            props.onAttachFiles(images);
          }}
          onKeyDown={(event) => {
            if (trigger !== undefined) {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex((index) => Math.min(index + 1, Math.max(visibleSuggestions.length - 1, 0)));
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex((index) => Math.max(index - 1, 0));
                return;
              }
              if (event.key === 'Enter' && !event.shiftKey && trigger.trigger === '/') {
                event.preventDefault();
                const selectedSlash =
                  activeSuggestion !== undefined && !activeSuggestion.disabled
                    ? activeSuggestion.id
                    : undefined;
                const text = resolveSlashSubmitText(props.value, trigger, selectedSlash);
                setTrigger(undefined);
                props.onSubmit(text);
                return;
              }
              if ((event.key === 'Enter' || event.key === 'Tab') && activeSuggestion !== undefined && !activeSuggestion.disabled) {
                event.preventDefault();
                activeSuggestion.onSelect();
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setTrigger(undefined);
                return;
              }
            }
            if (event.shiftKey && event.key === 'Tab') {
              event.preventDefault();
              props.onConfigure({
                interactionMode: nextShiftTabInteractionMode(props.interactionMode),
              });
              return;
            }
            if ((event.metaKey || event.ctrlKey) && event.key === '.') {
              event.preventDefault();
              const button = modeButton.current;
              if (button !== null) {
                setMenu({ kind: 'mode', anchor: anchorFromElement(button) });
              }
              return;
            }
            if (event.key === 'Enter' && !event.shiftKey && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              if (props.running) props.onSteer();
              else props.onSubmit();
              return;
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              props.onSubmit();
            }
          }}
          placeholder={composerPlaceholder(props.interactionMode, {
            running: props.running,
            steerShortcut,
          })}
          rows={1}
        />
        {trigger !== undefined ? (
          <ComposerSuggestions
            emptyMessage={suggestionEmptyMessage}
            items={visibleSuggestions}
            onSelect={(index) => visibleSuggestions[index]?.onSelect()}
            selectedIndex={selectedIndex}
            trigger={trigger.trigger}
          />
        ) : null}
        <div className="composer-toolbar">
          <div>
            <button
              aria-label="添加上下文与切换模式"
              className="circle-action"
              title="添加上下文与切换模式"
              onClick={(event) => setMenu({ kind: 'plus', anchor: anchorFromElement(event.currentTarget) })}
            >
              <Plus size={17} />
            </button>
            <button
              ref={modeButton}
              aria-label="切换工作模式"
              className={`composer-menu-button composer-mode-status ${interactionModeClassName(props.interactionMode)}`}
              title="切换工作模式"
              onClick={(event) => setMenu({ kind: 'mode', anchor: anchorFromElement(event.currentTarget) })}
            >
              {interactionModeIcon(props.interactionMode)}
              <span className="composer-toolbar-label">{INTERACTION_MODE_LABELS[props.interactionMode]}</span>
              <ChevronDown className="composer-toolbar-chevron" size={11} />
            </button>
            <button
              ref={permissionButton}
              aria-label="切换权限模式"
              className={`composer-menu-button${props.permission === 'yolo' ? ' composer-permission-yolo' : ''}`}
              title="切换权限模式"
              onClick={(event) => setMenu({ kind: 'permission', anchor: anchorFromElement(event.currentTarget) })}
            >
              {permissionIcon(props.permission)}
              <span className="composer-toolbar-label">{permissionToolbarLabel(props.permission)}</span>
              <ChevronDown className="composer-toolbar-chevron" size={11} />
            </button>
            {props.swarmActive === true ? (
              <span className="composer-swarm-badge"><Boxes size={11} /> 集群运行中</span>
            ) : null}
            {(props.backgroundAgents ?? 0) > 0 || (props.backgroundTasks ?? 0) > 0 ? (
              <span className="composer-bg-badge">
                <Bot size={11} />
                {(props.backgroundAgents ?? 0) > 0
                  ? `${String(props.backgroundAgents)} Agent`
                  : null}
                {(props.backgroundAgents ?? 0) > 0 && (props.backgroundTasks ?? 0) > 0 ? ' · ' : null}
                {(props.backgroundTasks ?? 0) > 0
                  ? `${String(props.backgroundTasks)} 任务`
                  : null}
              </span>
            ) : null}
            <button
              aria-label={`运行目标：${targetToolbarLabel}`}
              className="composer-menu-button"
              title={`运行目标：${targetToolbarLabel}`}
              onClick={(event) => setMenu({ kind: 'target', anchor: anchorFromElement(event.currentTarget) })}
            >
              {targetIcon(props.target)}
              <span className="composer-toolbar-label">{targetToolbarLabel}</span>
              <ChevronDown className="composer-toolbar-chevron" size={11} />
            </button>
          </div>
          <div>
            <div className="model-label-group">
              <button
                ref={modelButton}
                aria-label={modelFullLabel}
                className="model-label"
                title={modelFullLabel}
                onClick={(event) => {
                  setContextUsageOpen(undefined);
                  setMenu({ kind: 'model', anchor: anchorFromElement(event.currentTarget) });
                }}
              >
                {modelProviderIcon(props.model, props.models, 13)}
                <span className="composer-toolbar-label">{modelShortLabel(props.model, props.models)}</span>
                {modelThinkingEffort !== undefined ? (
                  <span className="composer-toolbar-thinking"> · {thinkingLabel(modelThinkingEffort)}</span>
                ) : null}
                <ChevronDown className="composer-toolbar-chevron" size={11} />
              </button>
              {contextRingAvailable ? (
                <ContextUsageRing
                  contextTokens={contextDisplay.displayTokens}
                  maxContextTokens={maxContextTokens}
                  onClick={(event) => {
                    setMenu(undefined);
                    setContextUsageOpen({ anchor: anchorFromElement(event.currentTarget) });
                  }}
                />
              ) : null}
            </div>
            {props.running ? (
              <button aria-label="停止任务" className="send-button stop" onClick={props.onCancel} title="停止任务"><CircleStop size={16} /></button>
            ) : (
              <button
                className="send-button"
                aria-label="发送"
                title="发送"
                disabled={props.sending || (props.value.trim().length === 0 && props.attachments.length === 0 && props.references.length === 0)}
                onClick={() => props.onSubmit()}
              >
                {props.sending ? <LoaderCircle className="spin" size={16} /> : <ArrowUp size={17} />}
              </button>
            )}
          </div>
        </div>
      </div>
      <small className="composer-hint">
        <TerminalSquare size={11} />{' '}
        {composerFooterHint({
          target: props.target,
          running: props.running,
          steerShortcut,
          platform: props.platform,
        })}
      </small>
      {menu !== undefined ? (
        <AppMenuPopover
          anchor={menu.anchor}
          ariaLabel="输入框菜单"
          items={activeMenuItems}
          onClose={() => setMenu(undefined)}
          placement={menu.kind === 'plus' ? 'top-start' : 'bottom-start'}
          searchPlaceholder={menu.kind === 'model' ? '搜索模型或服务商' : undefined}
        />
      ) : null}
      {contextUsageOpen !== undefined ? (
        <ContextUsagePopover
          anchor={contextUsageOpen.anchor}
          loading={contextUsageLoading}
          onClose={() => setContextUsageOpen(undefined)}
          pendingIndexLoading={indexContextLoading}
          pendingIndexPreview={indexContextPreview}
          sessionIndexTokens={sessionIndexTokens}
          snapshot={
            contextUsage ?? {
              contextTokens,
              maxContextTokens,
              categories: {
                systemPrompt: 0,
                toolDefinitions: 0,
                rules: 0,
                skills: 0,
                subagentDefinitions: 0,
                conversation: contextTokens,
              },
            }
          }
        />
      ) : null}
    </div>
  );
}

interface ComposerSuggestion {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly icon: ReactNode;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

function ComposerSuggestions(props: {
  readonly items: readonly ComposerSuggestion[];
  readonly selectedIndex: number;
  readonly trigger: ComposerTrigger;
  readonly emptyMessage?: string;
  readonly onSelect: (index: number) => void;
}): ReactNode {
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.min(props.selectedIndex, Math.max(props.items.length - 1, 0));

  useEffect(() => {
    const container = listRef.current;
    if (container === null) return;
    const buttons = container.querySelectorAll<HTMLButtonElement>('button[role="option"]');
    buttons[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div className="composer-suggestions" role="listbox" aria-label={`${props.trigger} 联想`}>
      <header>
        <span>{triggerTitle(props.trigger)}</span>
        <kbd>{props.trigger === '/' ? '↑↓ 选择 · ↵ 执行' : '↑↓ 选择 · ↵ 确认'}</kbd>
      </header>
      <div ref={listRef}>
        {props.items.slice(0, 12).map((item, index) => (
          <button
            aria-selected={index === activeIndex}
            className={index === activeIndex ? 'active' : undefined}
            disabled={item.disabled}
            key={item.id}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => props.onSelect(index)}
            role="option"
            type="button"
          >
            <span>{item.icon}</span>
            <span><strong>{item.label}</strong>{item.detail !== undefined ? <small>{item.detail}</small> : null}</span>
          </button>
        ))}
        {props.items.length === 0 ? <p>{props.emptyMessage ?? '没有匹配项'}</p> : null}
      </div>
    </div>
  );
}

function interactionModeMenuItems(
  current: InteractionMode,
  onConfigure: (config: SessionConfigurationInput) => void,
  running = false,
): readonly AppMenuItem[] {
  const items: AppMenuItem[] = [];
  for (const mode of INTERACTION_MODE_MENU_ORDER) {
    if (mode === 'engineering') {
      items.push({ id: 'mode-extension-separator', separator: true });
    }
    items.push({
      id: mode,
      label: INTERACTION_MODE_LABELS[mode],
      description: interactionModeMenuDescription(
        mode,
        interactionModeDescription(mode),
        running,
      ),
      icon: interactionModeIcon(mode),
      checked: current === mode,
      disabled: running,
      onSelect: () => onConfigure({ interactionMode: mode }),
    });
  }
  return items;
}

function permissionMenuItems(
  current: 'manual' | 'auto' | 'yolo',
  onConfigure: (config: SessionConfigurationInput) => void,
): readonly AppMenuItem[] {
  return (['manual', 'auto', 'yolo'] as const).map((permission) => ({
    id: permission,
    label: permissionToolbarLabel(permission),
    description: permissionDescription(permission),
    icon: permissionIcon(permission),
    checked: current === permission,
    danger: permission === 'yolo',
    onSelect: () => onConfigure({ permission }),
  }));
}

function targetMenuItems(
  current: 'local' | 'worktree' | 'ssh',
  sshProfileId: string | undefined,
  profiles: AppSettings['sshProfiles'],
  onTarget: (target: 'local' | 'worktree' | 'ssh', profileId?: string) => void,
): readonly AppMenuItem[] {
  return [
    { id: 'local', label: '本地工作区', icon: <Laptop />, checked: current === 'local', onSelect: () => onTarget('local') },
    { id: 'worktree', label: '新建 Worktree', icon: <GitBranch />, checked: current === 'worktree', onSelect: () => onTarget('worktree') },
    ...(profiles.length > 0 ? [{ id: 'target-separator', separator: true } as const] : []),
    ...profiles.map((profile) => ({
      id: `ssh:${profile.id}`,
      label: profile.label,
      description: `${profile.username}@${profile.host}`,
      icon: <Server />,
      checked: current === 'ssh' && profile.id === sshProfileId,
      onSelect: () => onTarget('ssh', profile.id),
    })),
  ];
}

function interactionModeIcon(mode: InteractionMode): ReactNode {
  if (mode === 'agent') return <Bot size={13} />;
  if (mode === 'engineering') return <Hammer size={13} />;
  if (mode === 'ask') return <MessageCircle size={13} />;
  if (mode === 'plan') return <ListTodo size={13} />;
  if (mode === 'debug') return <Bug size={13} />;
  return <Boxes size={13} />;
}

function interactionModeDescription(mode: InteractionMode): string {
  if (mode === 'agent') return '执行完整的软件开发任务';
  if (mode === 'engineering') {
    return 'KimiCodeBoost 驱动的系统化软件开发工作流（设计 → 计划 → TDD → 子代理执行 → 评审 → 收尾）';
  }
  if (mode === 'ask') return '围绕当前项目讨论与问答';
  if (mode === 'plan') return '先探索并生成可审阅的实现计划，确认后再构建';
  if (mode === 'debug') return '聚焦诊断问题和失败';
  return '并行处理多个子任务';
}

function permissionIcon(permission: 'manual' | 'auto' | 'yolo'): ReactNode {
  if (permission === 'manual') return <ShieldQuestion size={13} />;
  if (permission === 'auto') return <ShieldCheck size={13} />;
  return <ShieldAlert size={13} />;
}

function targetIcon(target: 'local' | 'worktree' | 'ssh'): ReactNode {
  if (target === 'local') return <Laptop size={13} />;
  if (target === 'worktree') return <GitBranch size={13} />;
  return <Server size={13} />;
}

function targetLabel(
  target: 'local' | 'worktree' | 'ssh',
  profileId: string | undefined,
  profiles: AppSettings['sshProfiles'],
): string {
  if (target === 'local') return '本地';
  if (target === 'worktree') return 'Worktree';
  return profiles.find((profile) => profile.id === profileId)?.label ?? 'SSH';
}

function triggerTitle(trigger: ComposerTrigger): string {
  if (trigger === '@') return '文件、文件夹与代码库';
  if (trigger === '/') return '命令';
  if (trigger === '$') return '技能';
  return '关联会话';
}

function referenceKey(reference: PromptReference): string {
  if (reference.kind === 'path') return `path:${reference.root}:${reference.path}`;
  if (reference.kind === 'skill') return `skill:${reference.name}`;
  if (reference.kind === 'codebase') return `codebase:${reference.query}`;
  return `session:${reference.sessionId}`;
}

function referenceLabel(reference: PromptReference): string {
  if (reference.kind === 'path') return reference.path;
  if (reference.kind === 'skill') return `$${reference.name}`;
  if (reference.kind === 'codebase') {
    return reference.query.trim().length === 0 ? '@codebase' : `@codebase ${reference.query}`;
  }
  return reference.title;
}

function referenceIcon(reference: PromptReference): ReactNode {
  if (reference.kind === 'path') {
    return reference.pathKind === 'directory' ? <Folder size={12} /> : <AtSign size={12} />;
  }
  if (reference.kind === 'skill') return <WandSparkles size={12} />;
  if (reference.kind === 'codebase') return <Search size={12} />;
  return <Hash size={12} />;
}

type SessionConfigurationInput = {
  readonly permission?: 'manual' | 'auto' | 'yolo';
  readonly model?: string;
  readonly thinking?: string;
  readonly interactionMode?: InteractionMode;
  readonly planMode?: boolean;
  readonly swarmMode?: boolean;
};

function SidePanel(props: {
  readonly panel: WorkspaceToolPanel;
  readonly project?: ProjectSummary;
  readonly session?: SessionSnapshot;
  readonly settings?: AppSettings;
  readonly timeline: readonly TimelineEntry[];
  readonly size: number;
  readonly embedded?: boolean;
  readonly onResizeStart: (coordinate: number) => void;
  readonly onClose: () => void;
  readonly onError: (message: string) => void;
  readonly onProjectUpdated: (project: ProjectSummary) => void;
  readonly onBrowserAnnotation: (annotation: BrowserAnnotation) => void;
  readonly browserPreviewUrl?: string;
  readonly onBrowserPreviewUrlConsumed?: () => void;
  readonly onPreviewFile?: (relativePath: string) => void;
  readonly onOpenInEditor?: (path: string, command?: string) => void;
  readonly availableEditors: readonly EditorPresetView[];
  readonly selectedPlanPath?: string;
  readonly onSelectedPlanPathChange?: (path: string | undefined) => void;
  readonly plansRefreshToken?: number;
  readonly onPreferEditor?: (command: string) => void;
  readonly planApproval?: PendingApproval;
  readonly models?: readonly ModelOption[];
  readonly model?: string;
  readonly thinking?: string;
  readonly platform?: NodeJS.Platform;
  readonly onConfigureModel?: (config: SessionConfigurationInput) => void;
  readonly onResolvePlanApproval?: (resolution: ApprovalResolution) => void;
  readonly terminalChrome?: 'rail' | 'bottom';
}): ReactNode {
  return (
    <aside
      className={`side-panel ${props.panel}${props.embedded === true ? ' embedded' : ''}`}
      style={
        props.embedded === true
          ? undefined
          : props.panel === 'terminal'
            ? { height: 'var(--terminal-height)' }
            : { width: props.size }
      }
    >
      {props.embedded === true ? null : (
        <div
          aria-hidden="true"
          className={`panel-resize-handle ${props.panel === 'terminal' ? 'vertical' : 'horizontal'}`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            props.onResizeStart(props.panel === 'terminal' ? event.clientY : event.clientX);
          }}
        />
      )}
      {props.panel === 'summary' ? (
        <SummaryPanel
          session={props.session}
          timeline={props.timeline}
          workDir={props.project?.workDir}
          onError={props.onError}
          onPreviewFile={props.onPreviewFile}
        />
      ) : null}
      {props.panel === 'review' ? (
        <ReviewPanel
          project={props.project}
          onError={props.onError}
          onProjectUpdated={props.onProjectUpdated}
        />
      ) : null}
      {props.panel === 'plans' ? (
        <PlansPanel
          project={props.project}
          selectedPath={props.selectedPlanPath}
          onSelectedPathChange={props.onSelectedPlanPathChange}
          onError={props.onError}
          onPreviewFile={props.onPreviewFile}
          planApproval={props.planApproval}
          models={props.models ?? []}
          model={props.model}
          thinking={props.thinking}
          platform={props.platform}
          onConfigureModel={props.onConfigureModel}
          onResolvePlanApproval={props.onResolvePlanApproval}
          refreshToken={props.plansRefreshToken}
        />
      ) : null}
      {props.panel === 'files' ? (
        <FilesPanel
          project={props.project}
          availableEditors={props.availableEditors}
          editorCommand={props.settings?.editorCommand}
          onError={props.onError}
          onPreviewFile={props.onPreviewFile}
          onOpenInEditor={props.onOpenInEditor}
          onPreferEditor={props.onPreferEditor}
        />
      ) : null}
      {props.panel === 'agents' ? <AgentsPanel session={props.session} onError={props.onError} /> : null}
      {props.panel === 'terminal' ? (
        <TerminalPanel
          project={props.project}
          session={props.session}
          settings={props.settings}
          chrome={props.terminalChrome ?? 'bottom'}
          onClose={props.onClose}
          onError={props.onError}
        />
      ) : null}
      {props.panel === 'browser' ? (
        <BrowserPanel
          embedded={props.embedded === true}
          projectWorkDir={props.project?.workDir}
          session={props.session}
          pendingUrl={props.browserPreviewUrl}
          onPendingUrlConsumed={props.onBrowserPreviewUrlConsumed}
          onAnnotation={props.onBrowserAnnotation}
          onClose={props.onClose}
          onError={props.onError}
        />
      ) : null}
    </aside>
  );
}

function SummaryPanel(props: {
  readonly session?: SessionSnapshot;
  readonly timeline: readonly TimelineEntry[];
  readonly workDir?: string;
  readonly onError: (message: string) => void;
  readonly onPreviewFile?: (relativePath: string) => void;
}): ReactNode {
  const tools = props.timeline.filter((entry) => entry.kind === 'tool');
  const errors = props.timeline.filter((entry) => entry.kind === 'error');
  const assistants = props.timeline.filter((entry) => entry.kind === 'assistant');
  const last = assistants.at(-1);
  const [billing, setBilling] = useState<DeepSeekBillingSnapshot>();
  const [billingLoading, setBillingLoading] = useState(false);
  const billingRefreshKey = `${props.timeline.length}:${props.session?.status.running === true ? 1 : 0}`;

  const refreshBilling = useCallback(
    (refreshBalance = false) => {
      if (props.session === undefined) {
        setBilling(undefined);
        return;
      }
      setBillingLoading(true);
      void api
        .deepSeekBillingSnapshot({
          sessionId: props.session.id,
          refreshBalance,
        })
        .then(setBilling)
        .catch((cause) => props.onError(messageOf(cause)))
        .finally(() => setBillingLoading(false));
    },
    [props.session?.id, props.onError],
  );

  useEffect(() => {
    refreshBilling(true);
    if (props.session === undefined) return;
    const timer = window.setInterval(() => refreshBilling(false), 30_000);
    return () => window.clearInterval(timer);
  }, [refreshBilling, props.session?.id]);

  useEffect(() => {
    if (props.session === undefined) return;
    refreshBilling(false);
  }, [billingRefreshKey, props.session?.id, refreshBilling]);

  return (
    <div className="panel-content">
      <div className="metric-grid">
        <Metric label="工具调用" value={tools.length} />
        <Metric label="错误" value={errors.length} />
        <Metric label="上下文" value={`${Math.round(((props.session?.status.contextTokens ?? 0) / Math.max(1, props.session?.status.maxContextTokens ?? 1)) * 100)}%`} />
        <Metric label="模式" value={INTERACTION_MODE_LABELS[props.session?.status.interactionMode ?? 'agent']} />
      </div>
      {billing?.enabled === true ? (
        <section className="summary-section billing-section">
          <div className="billing-head">
            <h3>DeepSeek 计费</h3>
            <button
              className="billing-refresh"
              disabled={billingLoading}
              onClick={() => refreshBilling(true)}
              type="button"
            >
              <RefreshCw size={12} /> {billingLoading ? '刷新中' : '刷新'}
            </button>
          </div>
          <div className="billing-grid">
            <Metric
              label="余额"
              value={
                billing.balanceError !== undefined
                  ? '—'
                  : billing.balanceAvailable
                    ? formatBalanceDisplay(billing.balanceCny)
                    : '余额不足'
              }
            />
            <Metric
              label={billing.isPeakNow ? '会话预估 (高峰)' : '会话预估'}
              value={formatCnyDisplay(billing.estimatedCostCny)}
            />
            <Metric
              label="输入 Token"
              value={formatTokenShort(billing.sessionInput)}
            />
            <Metric
              label="输出 Token"
              value={formatTokenShort(billing.sessionOutput)}
            />
          </div>
          {billing.sessionInput > 0 || billing.sessionOutput > 0 ? (
            <div className="billing-breakdown">
              <span>
                缓存命中 {formatTokenShort(billing.sessionCacheHit)}
                {billing.sessionCacheHitPct !== null ? ` (${billing.sessionCacheHitPct}%)` : ''}
              </span>
              <span>缓存未命中 {formatTokenShort(billing.sessionCacheMiss)}</span>
            </div>
          ) : (
            <p className="muted billing-note">暂无 Token 用量数据，发送消息后更新</p>
          )}
          {billing.balanceError !== undefined ? (
            <p className="muted billing-note">{billing.balanceError}</p>
          ) : billing.balanceCny !== null ? (
            <p className="muted billing-note">
              赠额 ¥{billing.grantedCny ?? '0'} · 充值 ¥{billing.toppedUpCny ?? billing.balanceCny}
            </p>
          ) : null}
          <p className="billing-peak">
            {billing.isPeakNow
              ? '当前：高峰时段（北京时间 9:00–12:00 / 14:00–18:00，单价 ×2）'
              : '当前：非高峰（高峰为北京时间 9:00–12:00 / 14:00–18:00）'}
          </p>
          {billing.rates !== null && billing.peakRates !== null ? (
            <table className="billing-price-table">
              <caption>
                {billing.modelId ?? '模型'} 单价（¥ / 1M tokens）
              </caption>
              <thead>
                <tr>
                  <th>类型</th>
                  <th>非高峰</th>
                  <th>高峰</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>缓存命中</td>
                  <td>{billing.rates.hit}</td>
                  <td>{billing.peakRates.hit}</td>
                </tr>
                <tr>
                  <td>缓存未命中</td>
                  <td>{billing.rates.miss}</td>
                  <td>{billing.peakRates.miss}</td>
                </tr>
                <tr>
                  <td>输出</td>
                  <td>{billing.rates.out}</td>
                  <td>{billing.peakRates.out}</td>
                </tr>
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
      <section className="summary-section">
        <h3>当前任务</h3>
        <p>{props.session?.title ?? '尚未开始任务'}</p>
      </section>
      <section className="summary-section">
        <h3>最新结果</h3>
        {last !== undefined ? (
          <MarkdownMessage
            content={last.content.slice(0, 2_000)}
            workDir={props.workDir}
            onPreviewFile={props.onPreviewFile}
            onOpenExternal={openExternalFromTimeline}
          />
        ) : <p className="muted">暂无结果</p>}
      </section>
    </div>
  );
}

function formatBalanceDisplay(value: string | null): string {
  if (value === null) return '—';
  const trimmed = value.trim();
  return trimmed.startsWith('¥') ? trimmed : `¥${trimmed}`;
}

function formatCnyDisplay(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '¥0.00';
  if (amount >= 0.01) return `¥${amount.toFixed(2)}`;
  return `¥${amount.toFixed(4)}`;
}

function formatTokenShort(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

function AgentsPanel(props: {
  readonly session?: SessionSnapshot;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [tasks, setTasks] = useState<readonly BackgroundTaskView[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [output, setOutput] = useState('');
  const refresh = useCallback(() => {
    if (props.session === undefined) {
      setTasks([]);
      return;
    }
    void api.listBackgroundTasks(props.session.id)
      .then(setTasks)
      .catch((cause) => props.onError(messageOf(cause)));
  }, [props.session?.id, props.onError]);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 2_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (props.session?.id === undefined) {
      setSelectedId(undefined);
      return;
    }
    setSelectedId(readSessionUi(props.session.id).agentsSelectedTaskId);
  }, [props.session?.id]);
  useEffect(() => {
    if (props.session?.id === undefined) return;
    writeSessionUi(props.session.id, { agentsSelectedTaskId: selectedId });
  }, [props.session?.id, selectedId]);
  useEffect(() => {
    if (props.session === undefined || selectedId === undefined) {
      setOutput('');
      return;
    }
    void api.getBackgroundTaskOutput(props.session.id, selectedId, 40_000)
      .then(setOutput)
      .catch((cause) => props.onError(messageOf(cause)));
  }, [props.session?.id, selectedId, tasks, props.onError]);
  if (props.session === undefined) {
    return <EmptyPanel icon={<Boxes />} text="打开任务后查看并行 Agent" />;
  }
  const activeCount = tasks.filter((task) => task.status === 'running').length;
  return (
    <div className="panel-content agents-panel">
      <div className="agents-overview">
        <span><strong>{activeCount}</strong> 运行中</span>
        <span><strong>{tasks.length}</strong> 总任务</span>
        <button onClick={refresh}><RefreshCw size={12} /> 刷新</button>
      </div>
      {tasks.length === 0 ? (
        <EmptyPanel
          icon={<Bot />}
          text={
            props.session?.status.interactionMode === 'multitask' ||
            props.session?.status.swarmMode === true
              ? '暂无后台任务。集群子 Agent 的进度显示在主对话区的 AgentSwarm 块中。'
              : '当前还没有后台 Agent 或任务'
          }
        />
      ) : (
        <div className="agent-task-list">
          {tasks.map((task) => (
            <article className={selectedId === task.taskId ? 'selected' : ''} key={task.taskId}>
              <button className="agent-task-main" onClick={() => setSelectedId(task.taskId)}>
                {task.kind === 'agent' ? <Bot size={14} /> : <TerminalSquare size={14} />}
                <span>
                  <strong>{task.subagentType ?? task.description}</strong>
                  <small>{task.subagentType === undefined ? task.taskId : task.description}</small>
                </span>
                <em className={`task-status ${task.status}`}>{backgroundTaskStatusLabel(task.status)}</em>
              </button>
              {task.status === 'running' ? (
                <button
                  className="agent-task-stop"
                  onClick={() => void api.stopBackgroundTask(props.session!.id, task.taskId)
                    .then(refresh)
                    .catch((cause) => props.onError(messageOf(cause)))}
                >
                  <CircleStop size={12} /> 停止
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {selectedId !== undefined ? (
        <section className="agent-output">
          <div><strong>任务输出</strong><code>{selectedId}</code></div>
          <pre>{output || '暂无输出'}</pre>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: ReactNode }): ReactNode {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}

function FilesPanel(props: {
  readonly project?: ProjectSummary;
  readonly availableEditors: readonly EditorPresetView[];
  readonly editorCommand?: string;
  readonly onError: (message: string) => void;
  readonly onPreviewFile?: (relativePath: string) => void;
  readonly onOpenInEditor?: (path: string, command?: string) => void;
  readonly onPreferEditor?: (command: string) => void;
}): ReactNode {
  const [entries, setEntries] = useState<readonly FileEntry[]>([]);
  const [selected, setSelected] = useState<FileContent>();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (props.project === undefined) {
      setEntries([]);
      setSelected(undefined);
      setLoading(false);
      return;
    }
    let alive = true;
    const savedSelectedPath = readProjectUi(props.project.workDir).filesSelectedPath;
    setEntries([]);
    setSelected(undefined);
    setLoading(true);
    void api.listFiles(props.project.workDir)
      .then(async (items) => {
        if (!alive) return;
        setEntries(items);
        if (savedSelectedPath === undefined) return;
        try {
          const content = await api.readFile(props.project!.workDir, savedSelectedPath);
          if (alive) setSelected(content);
        } catch {
          // Saved file may have been removed.
        }
      })
      .catch((cause) => props.onError(messageOf(cause)))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [props.project, props.onError]);
  useEffect(() => {
    if (props.project === undefined || selected === undefined) return;
    writeProjectUi(props.project.workDir, { filesSelectedPath: selected.path });
  }, [props.project?.workDir, selected?.path]);
  async function open(path: string): Promise<void> {
    if (props.project === undefined) return;
    try {
      const content = await api.readFile(props.project.workDir, path);
      setSelected(content);
    } catch (cause) {
      props.onError(messageOf(cause));
    }
  }
  if (props.project === undefined) return <EmptyPanel icon={<FileText />} text="选择项目后浏览文件" />;
  const selectedRelative =
    selected === undefined
      ? undefined
      : selected.path.startsWith(props.project.workDir)
        ? selected.path.slice(props.project.workDir.length).replace(/^[/\\]+/, '')
        : selected.path;
  const canPreview =
    selected !== undefined &&
    selectedRelative !== undefined &&
    isHtmlPath(selected.name);
  return (
    <div className="files-layout">
      <div className="file-tree">
        {loading ? (
          <div className="file-tree-state"><LoaderCircle className="spin" size={15} /> 正在读取文件…</div>
        ) : entries.length === 0 ? (
          <div className="file-tree-state"><Folder size={15} /> 此项目暂无文件</div>
        ) : (
          <FileTree entries={entries} selectedPath={selected?.path} onOpen={(path) => void open(path)} />
        )}
      </div>
      {selected !== undefined ? (
        <div className="file-preview">
          <div className="file-preview-head">
            <strong>{selected.name}</strong>
            <div className="file-preview-actions">
              {canPreview ? (
                <button
                  aria-label="在内置浏览器预览"
                  title="在内置浏览器预览"
                  type="button"
                  onClick={() => {
                    if (selectedRelative !== undefined) props.onPreviewFile?.(selectedRelative);
                  }}
                >
                  <Globe2 size={13} />
                </button>
              ) : null}
              {props.onOpenInEditor !== undefined ? (
                <EditorShortcuts
                  workDir={props.project.workDir}
                  editorCommand={props.editorCommand}
                  available={props.availableEditors}
                  scope="file"
                  onOpen={(command) => props.onOpenInEditor?.(selected.path, command)}
                  onPrefer={(command) => props.onPreferEditor?.(command)}
                  onOpenSystem={() => void api.openFileExternal(selected.path)}
                />
              ) : null}
              <button
                aria-label="在外部应用打开"
                title="在外部应用打开"
                type="button"
                onClick={() => void api.openFileExternal(selected.path)}
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </div>
          {selected.kind === 'text' ? (
            <CodeSurface
              value={selected.content ?? ''}
              language={languageFromPath(selected.name)}
              readOnly
              className="file-code"
            />
          ) : selected.dataUrl !== undefined ? (
            selected.kind === 'image' ? <img src={selected.dataUrl} /> : <embed src={selected.dataUrl} />
          ) : <div className="binary-file">无法在应用内预览该文件。</div>}
        </div>
      ) : (
        <div className="file-preview file-preview-empty">
          <EmptyPanel icon={<FileCode2 />} text="从左侧文件树选择文件进行预览" />
        </div>
      )}
    </div>
  );
}

function FileTree(props: {
  readonly entries: readonly FileEntry[];
  readonly selectedPath?: string;
  readonly onOpen: (path: string) => void;
}): ReactNode {
  return (
    <>
      {props.entries.map((entry) => (
        <FileNode
          key={entry.path}
          entry={entry}
          selectedPath={props.selectedPath}
          onOpen={props.onOpen}
        />
      ))}
    </>
  );
}

function FileNode(props: {
  readonly entry: FileEntry;
  readonly selectedPath?: string;
  readonly onOpen: (path: string) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  if (props.entry.kind === 'directory') {
    return (
      <div className="file-node directory">
        <button onClick={() => setOpen((value) => !value)}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Folder size={13} />
          <span>{props.entry.name}</span>
        </button>
        {open && props.entry.children !== undefined ? (
          <div className="file-children">
            <FileTree
              entries={props.entry.children}
              selectedPath={props.selectedPath}
              onOpen={props.onOpen}
            />
          </div>
        ) : null}
      </div>
    );
  }
  const selected = props.entry.path === props.selectedPath;
  return (
    <button
      aria-current={selected ? 'page' : undefined}
      className={`file-node file${selected ? ' active' : ''}`}
      onClick={() => props.onOpen(props.entry.path)}
      type="button"
    >
      <FileCode2 size={13} />
      <span>{props.entry.name}</span>
    </button>
  );
}

function readMonoFontCssVar(): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue('--font-mono');
}

function readXtermCellHeight(xterm: XTerm): number | undefined {
  const core = (xterm as XTerm & {
    readonly _core?: {
      readonly _renderService?: {
        readonly dimensions?: { readonly css: { readonly cell: { readonly height: number } } };
      };
    };
  })._core;
  const cellHeight = core?._renderService?.dimensions?.css.cell.height;
  if (cellHeight === undefined || cellHeight <= 0) return undefined;
  return cellHeight;
}

/** FitAddon sizes to whole rows; shrink the xterm element so no viewport gap remains. */
function clampTerminalVisualHeight(fitAddon: FitAddon, xterm: XTerm): void {
  const element = xterm.element;
  if (element === undefined) return;
  const proposed = fitAddon.proposeDimensions();
  const cellHeight = readXtermCellHeight(xterm);
  if (proposed === undefined || cellHeight === undefined) return;
  const height = Math.ceil(proposed.rows * cellHeight);
  element.style.height = `${height}px`;
  element.style.flex = '0 0 auto';
}

function scheduleTerminalFit(
  fitAddon: FitAddon | undefined,
  xterm: XTerm | undefined,
  activeId: string | undefined,
  reportError: (cause: unknown) => void,
  frameRef: { current: number | undefined },
): void {
  if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      if (fitAddon === undefined || xterm === undefined) return;
      try {
        fitAddon.fit();
        clampTerminalVisualHeight(fitAddon, xterm);
      } catch {
        return;
      }
      if (activeId === undefined) return;
      void api.terminalResize(activeId, xterm.cols, xterm.rows).catch(reportError);
    });
  });
}

function observeTerminalHostLayout(
  host: HTMLElement,
  onResize: () => void,
): () => void {
  const observed = new Set<Element>();
  const observe = (element: Element | null): void => {
    for (let node = element; node !== null; node = node.parentElement) {
      if (observed.has(node)) return;
      observed.add(node);
      observer.observe(node);
    }
  };
  const observer = new ResizeObserver(onResize);
  observe(host);
  window.addEventListener('resize', onResize);
  onResize();
  return () => {
    observer.disconnect();
    window.removeEventListener('resize', onResize);
  };
}

function TerminalPanel(props: {
  readonly project?: ProjectSummary;
  readonly session?: SessionSnapshot;
  readonly settings?: AppSettings;
  readonly chrome: 'rail' | 'bottom';
  readonly onClose: () => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const terminal = useRef<XTerm | undefined>(undefined);
  const fitAddon = useRef<FitAddon | undefined>(undefined);
  const panelAlive = useRef(true);
  const [tabs, setTabs] = useState<readonly TerminalInfo[]>([]);
  const tabsRef = useRef<readonly TerminalInfo[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const activeIdRef = useRef<string | undefined>(undefined);
  const buffers = useRef(new Map<string, string>());
  const exitedIds = useRef(new Set<string>());
  const fitFrameRef = useRef<number | undefined>(undefined);
  const onErrorRef = useRef(props.onError);
  onErrorRef.current = props.onError;

  const reportTerminalError = useCallback((cause: unknown): void => {
    if (panelAlive.current) onErrorRef.current(messageOf(cause));
  }, []);

  const scheduleFit = useCallback((): void => {
    scheduleTerminalFit(
      fitAddon.current,
      terminal.current,
      activeIdRef.current,
      reportTerminalError,
      fitFrameRef,
    );
  }, [reportTerminalError]);

  const showTabBuffer = useCallback((id: string): void => {
    terminal.current?.reset();
    terminal.current?.write(buffers.current.get(id) ?? '');
    scheduleFit();
  }, [scheduleFit]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const createTab = useCallback(async () => {
    if (props.project === undefined) return;
    try {
      const created = await api.createTerminal(props.project.workDir, props.session?.id);
      if (!panelAlive.current) {
        void api.closeTerminal(created.id);
        return;
      }
      if (!buffers.current.has(created.id)) buffers.current.set(created.id, '');
      exitedIds.current.delete(created.id);
      setTabs((current) => [...current, created]);
      activeIdRef.current = created.id;
      setActiveId(created.id);
      showTabBuffer(created.id);
    } catch (cause) {
      if (panelAlive.current) props.onError(messageOf(cause));
    }
  }, [props.project, props.session?.id, props.onError, showTabBuffer]);

  const fontFamily = props.settings !== undefined
    ? resolveMonoFont(props.settings, readMonoFontCssVar)
    : DEFAULT_MONO_FONT;
  const fontSize = props.settings !== undefined
    ? resolveTerminalFontSize(props.settings)
    : DEFAULT_TERMINAL_FONT_SIZE;

  useEffect(() => {
    if (host.current === null || props.project === undefined) return;
    const initialFontFamily = props.settings !== undefined
      ? resolveMonoFont(props.settings, readMonoFontCssVar)
      : DEFAULT_MONO_FONT;
    const initialFontSize = props.settings !== undefined
      ? resolveTerminalFontSize(props.settings)
      : DEFAULT_TERMINAL_FONT_SIZE;
    const theme = typeof document === 'undefined'
      ? DEFAULT_XTERM_THEME
      : readTerminalThemeFromDocument();
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: initialFontSize,
      fontFamily: initialFontFamily,
      scrollback: 5000,
      theme,
    });
    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xterm.open(host.current);
    terminal.current = xterm;
    fitAddon.current = fit;
    const unsubData = api.onTerminalData((event) => {
      buffers.current.set(event.id, `${buffers.current.get(event.id) ?? ''}${event.data}`.slice(-200_000));
      if (event.id === activeIdRef.current) xterm.write(event.data);
    });
    const unsubExit = api.onTerminalExit((event) => {
      exitedIds.current.add(event.id);
      const suffix = `\r\n[process exited ${String(event.exitCode)}]\r\n`;
      buffers.current.set(event.id, `${buffers.current.get(event.id) ?? ''}${suffix}`);
      if (event.id === activeIdRef.current) xterm.write(suffix);
    });
    const stopObservingLayout = observeTerminalHostLayout(host.current, scheduleFit);
    const inputDisposable = xterm.onData((data) => {
      const id = activeIdRef.current;
      if (id === undefined) return;
      if (exitedIds.current.has(id)) {
        onErrorRef.current('终端进程已退出');
        return;
      }
      void api.terminalInput(id, data).catch(reportTerminalError);
    });
    // Font/theme updates are applied by the dedicated effect below; recreating xterm on
    // every settings change would wipe the visible buffer.
    return () => {
      if (fitFrameRef.current !== undefined) cancelAnimationFrame(fitFrameRef.current);
      fitFrameRef.current = undefined;
      unsubData();
      unsubExit();
      stopObservingLayout();
      inputDisposable.dispose();
      xterm.dispose();
      terminal.current = undefined;
      fitAddon.current = undefined;
    };
  }, [props.project, reportTerminalError, scheduleFit]);

  useEffect(() => {
    if (props.project === undefined) return;
    let alive = true;
    panelAlive.current = true;
    setTabs([]);
    setActiveId(undefined);
    buffers.current.clear();
    exitedIds.current.clear();
    const sessionId = props.session?.id;
    const snapshot = readProjectRuntime(props.project.workDir);
    const tabCount = Math.max(1, snapshot.terminalTabCount);
    const activeIndex = Math.min(Math.max(0, snapshot.activeTerminalIndex), tabCount - 1);
    void (async () => {
      try {
        const created: TerminalInfo[] = [];
        for (let index = 0; index < tabCount; index += 1) {
          if (!alive) break;
          const tab = await api.createTerminal(props.project!.workDir, sessionId);
          if (!alive) {
            void api.closeTerminal(tab.id);
            return;
          }
          if (!buffers.current.has(tab.id)) buffers.current.set(tab.id, '');
          exitedIds.current.delete(tab.id);
          created.push(tab);
        }
        if (!alive) return;
        setTabs(created);
        const active = created[activeIndex] ?? created[0];
        if (active === undefined) return;
        activeIdRef.current = active.id;
        setActiveId(active.id);
        showTabBuffer(active.id);
      } catch (cause) {
        if (alive) props.onError(messageOf(cause));
      }
    })();
    return () => {
      alive = false;
      panelAlive.current = false;
      for (const tab of tabsRef.current) void api.closeTerminal(tab.id);
      tabsRef.current = [];
      buffers.current.clear();
      exitedIds.current.clear();
    };
  }, [props.project, props.onError, showTabBuffer]);

  useEffect(() => {
    if (props.project === undefined || tabs.length === 0) return;
    const activeIndex = tabs.findIndex((tab) => tab.id === activeId);
    writeProjectRuntime(props.project.workDir, {
      terminalTabCount: tabs.length,
      activeTerminalIndex: activeIndex < 0 ? 0 : activeIndex,
    });
  }, [props.project?.workDir, tabs, activeId]);

  useEffect(() => {
    if (terminal.current === undefined) return;
    terminal.current.options.fontFamily = fontFamily;
    terminal.current.options.fontSize = fontSize;
    terminal.current.options.theme = readTerminalThemeFromDocument();
    terminal.current.refresh(0, Math.max(0, terminal.current.rows - 1));
    scheduleFit();
  }, [fontFamily, fontSize, props.settings?.theme, props.settings?.accentDark, props.settings?.accentLight, scheduleFit]);

  const clearActive = useCallback(() => {
    if (activeId === undefined) return;
    if (exitedIds.current.has(activeId)) {
      props.onError('终端进程已退出');
      return;
    }
    buffers.current.set(activeId, '');
    terminal.current?.clear();
    void api.terminalInput(activeId, '\x0c').catch(reportTerminalError);
  }, [activeId, props.onError, reportTerminalError]);

  const copySelection = useCallback(() => {
    const selection = terminal.current?.getSelection() ?? '';
    if (selection.length === 0) return;
    void navigator.clipboard.writeText(selection).catch((cause: unknown) => {
      props.onError(messageOf(cause));
    });
  }, [props.onError]);

  if (props.project === undefined) return <EmptyPanel icon={<TerminalSquare />} text="选择项目后打开终端" />;

  const tabBar = useMemo(() => (
    <div className="workspace-rail-tab-bar terminal-tabs">
      {tabs.map((tab, index) => (
        <button
          aria-selected={tab.id === activeId}
          className={tab.id === activeId ? 'active' : ''}
          key={tab.id}
          onClick={() => {
            activeIdRef.current = tab.id;
            setActiveId(tab.id);
            showTabBuffer(tab.id);
          }}
          role="tab"
          title={tab.title}
          type="button"
        >
          <TerminalSquare size={12} />
          <span>{tab.title} {index + 1}</span>
          <X size={11} onClick={(event) => {
            event.stopPropagation();
            void api.closeTerminal(tab.id);
            buffers.current.delete(tab.id);
            exitedIds.current.delete(tab.id);
            const remaining = tabs.filter((item) => item.id !== tab.id);
            setTabs(remaining);
            const next = remaining.at(-1)?.id;
            activeIdRef.current = next;
            setActiveId(next);
            if (next !== undefined) showTabBuffer(next);
            else terminal.current?.reset();
          }} />
        </button>
      ))}
      <button aria-label="新建终端标签" onClick={() => void createTab()} title="新建终端标签" type="button">
        <Plus size={12} />
      </button>
      <div className="workspace-rail-tab-bar__actions terminal-tab-actions">
        <button aria-label="复制选中内容" onClick={copySelection} title="复制选中内容" type="button">
          <Copy size={12} />
        </button>
        <button aria-label="清屏" onClick={clearActive} title="清屏" type="button">
          <Eraser size={12} />
        </button>
        <button
          aria-label="关闭终端面板"
          className="terminal-panel-close"
          onClick={props.onClose}
          title="关闭终端面板"
          type="button"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  ), [activeId, clearActive, copySelection, createTab, props.onClose, showTabBuffer, tabs]);

  return (
    <>
      {props.chrome === 'rail' ? <WorkspaceRailChromeSlot>{tabBar}</WorkspaceRailChromeSlot> : null}
      <div className={`terminal-panel${props.chrome === 'rail' ? ' terminal-panel--rail' : ''}`}>
        {props.chrome === 'bottom' ? tabBar : null}
        <div className="terminal-host" ref={host} />
      </div>
    </>
  );
}

interface BrowserBookmarkItem {
  readonly id: string;
  readonly title: string;
  readonly url: string;
}

function BrowserPanel(props: {
  readonly embedded?: boolean;
  readonly projectWorkDir?: string;
  readonly session?: SessionSnapshot;
  readonly pendingUrl?: string;
  readonly onPendingUrlConsumed?: () => void;
  readonly onAnnotation: (annotation: BrowserAnnotation) => void;
  readonly onClose: () => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const initialBrowserUi = useMemo(() => {
    const sessionSnapshot = props.session?.id === undefined
      ? undefined
      : readSessionRuntime(props.session.id);
    const projectSnapshot = props.projectWorkDir === undefined
      ? undefined
      : readProjectRuntime(props.projectWorkDir);
    const browserTabs = browserTabsToRestore(
      sessionSnapshot?.browserTabs ?? projectSnapshot?.browserTabs,
    );
    return {
      browserTabs,
      browserTabsRestoreKey: browserTabsRestoreKey(browserTabs),
      bookmarksOpen: sessionSnapshot?.browserBookmarksOpen
        ?? projectSnapshot?.browserBookmarksOpen
        ?? true,
    };
  }, [props.projectWorkDir, props.session?.id]);
  const [tabs, setTabs] = useState<readonly BrowserTab[]>([]);
  const tabsRef = useRef<readonly BrowserTab[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const activeIdRef = useRef<string | undefined>(undefined);
  const [url, setUrl] = useState('about:blank');
  const [annotating, setAnnotating] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [bookmarksOpen, setBookmarksOpen] = useState(initialBrowserUi.bookmarksOpen);
  const [browserMenuAnchor, setBrowserMenuAnchor] = useState<MenuAnchor>();
  const [bookmarks, setBookmarks] = useState<readonly BrowserBookmarkItem[]>(readBrowserBookmarks);
  const viewport = useRef<HTMLDivElement>(null);
  const activeTab = tabs.find((tab) => tab.id === activeId);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const createTab = useCallback(async (initialUrl = 'about:blank') => {
    try {
      const tab = await api.createBrowser(props.session?.id, initialUrl);
      setTabs((current) => [...current, tab]);
      setActiveId(tab.id);
      setUrl(tab.url);
    } catch (cause) {
      props.onError(messageOf(cause));
    }
  }, [props.session?.id, props.onError]);

  useEffect(() => {
    setBookmarksOpen(initialBrowserUi.bookmarksOpen);
  }, [initialBrowserUi.bookmarksOpen]);

  useEffect(() => {
    let alive = true;
    const pendingTabIds: string[] = [];
    setTabs([]);
    setActiveId(undefined);
    const { urls, activeIndex } = initialBrowserUi.browserTabs;
    const unsubscribe = api.onBrowserState((next) => {
      if (!alive) return;
      setTabs((current) => {
        const index = current.findIndex((item) => item.id === next.id);
        if (index < 0) return current;
        const copy = [...current];
        copy[index] = next;
        return copy;
      });
      if (next.id === activeIdRef.current) setUrl(next.url);
    });
    void (async () => {
      try {
        const created: BrowserTab[] = [];
        for (const initialUrl of urls) {
          if (!alive) break;
          const tab = await api.createBrowser(props.session?.id, initialUrl);
          if (!alive) {
            void api.closeBrowser(tab.id);
            return;
          }
          pendingTabIds.push(tab.id);
          created.push(tab);
        }
        if (!alive) {
          for (const id of pendingTabIds) void api.closeBrowser(id);
          return;
        }
        setTabs(created);
        const active = created[activeIndex] ?? created[0];
        if (active === undefined) return;
        activeIdRef.current = active.id;
        setActiveId(active.id);
        setUrl(active.url);
      } catch (cause: unknown) {
        if (alive) props.onError(messageOf(cause));
      }
    })();
    return () => {
      alive = false;
      unsubscribe();
      for (const id of pendingTabIds) void api.closeBrowser(id);
      for (const tab of tabsRef.current) void api.closeBrowser(tab.id);
      tabsRef.current = [];
    };
  }, [initialBrowserUi.browserTabsRestoreKey, props.onError, props.projectWorkDir, props.session?.id]);

  useEffect(() => {
    if (tabs.length === 0) return;
    const browserTabs = snapshotFromBrowserTabs(tabs, activeId);
    if (props.session?.id !== undefined) {
      writeSessionRuntime(props.session.id, {
        browserTabs,
        browserBookmarksOpen: bookmarksOpen,
      });
      return;
    }
    if (props.projectWorkDir !== undefined) {
      writeProjectRuntime(props.projectWorkDir, {
        browserTabs,
        browserBookmarksOpen: bookmarksOpen,
      });
    }
  }, [tabs, activeId, bookmarksOpen, props.projectWorkDir, props.session?.id]);

  useEffect(() => {
    if (props.pendingUrl === undefined || activeId === undefined) return;
    const target = props.pendingUrl;
    setUrl(target);
    void api.browserNavigate(activeId, target)
      .then(() => props.onPendingUrlConsumed?.())
      .catch((cause) => props.onError(messageOf(cause)));
  }, [props.pendingUrl, activeId, props.onPendingUrlConsumed, props.onError]);

  useEffect(() => {
    if (activeTab === undefined || viewport.current === null) return;
    const element = viewport.current;
    let frame = 0;
    const update = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        void api.browserBounds(activeTab.id, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.parentElement !== null) observer.observe(element.parentElement);
    window.addEventListener('resize', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      void api.hideBrowser(activeTab.id);
    };
  }, [activeTab?.id]);

  const closeTab = useCallback((id: string): void => {
    const index = tabs.findIndex((tab) => tab.id === id);
    const remaining = tabs.filter((tab) => tab.id !== id);
    setTabs(remaining);
    void api.closeBrowser(id);
    if (id !== activeId) return;
    const next = remaining[Math.min(index, remaining.length - 1)];
    if (next === undefined) {
      setActiveId(undefined);
      setUrl('about:blank');
      void createTab();
      return;
    }
    setActiveId(next.id);
    setUrl(next.url);
  }, [activeId, createTab, tabs]);

  const saveBookmarks = (next: readonly BrowserBookmarkItem[]): void => {
    setBookmarks(next);
    localStorage.setItem('ganymede.browserBookmarks', JSON.stringify(next));
  };

  const bookmarkActive = (): void => {
    if (activeTab === undefined || activeTab.url === 'about:blank') return;
    const existing = bookmarks.find((item) => item.url === activeTab.url);
    if (existing !== undefined) {
      saveBookmarks(bookmarks.filter((item) => item.id !== existing.id));
      return;
    }
    saveBookmarks([
      ...bookmarks,
      { id: crypto.randomUUID(), title: browserPageTitle(activeTab), url: activeTab.url },
    ]);
    setBookmarksOpen(true);
  };

  const annotate = async (): Promise<void> => {
    if (activeTab === undefined || annotating) return;
    try {
      setAnnotating(true);
      setFeedback('在页面中点击要引用的元素');
      const annotation = await api.browserAnnotate(activeTab.id);
      if (annotation === undefined) {
        setFeedback('已取消标注');
        return;
      }
      props.onAnnotation(annotation);
      setFeedback(`已附加 ${annotation.selector}`);
    } catch (cause) {
      props.onError(messageOf(cause));
      setFeedback('标注失败');
    } finally {
      setAnnotating(false);
    }
  };

  const bookmarked = activeTab !== undefined && bookmarks.some((item) => item.url === activeTab.url);
  const zoomLabel = `${String(Math.round((activeTab?.zoomFactor ?? 1) * 100))}%`;

  const captureScreenshot = useCallback((): void => {
    if (activeTab === undefined) return;
    void api.browserScreenshot(activeTab.id)
      .then((data) => downloadDataUrl(data, 'ganymede-browser.png'))
      .catch((cause: unknown) => props.onError(messageOf(cause)));
  }, [activeTab, props.onError]);

  const browserMenuItems = useMemo((): readonly AppMenuItem[] => {
    const tabId = activeTab?.id;
    const disabled = tabId === undefined;
    return [
      {
        id: 'bookmarks-bar',
        label: '显示书签栏',
        icon: <Bookmark size={14} />,
        checked: bookmarksOpen,
        onSelect: () => setBookmarksOpen((value) => !value),
      },
      { id: 'browser-menu-sep-1', separator: true },
      {
        id: 'zoom-in',
        label: '放大',
        icon: <ZoomIn size={14} />,
        disabled,
        onSelect: () => tabId !== undefined && void api.browserAction(tabId, 'zoom-in'),
      },
      {
        id: 'zoom-out',
        label: '缩小',
        icon: <ZoomOut size={14} />,
        disabled,
        onSelect: () => tabId !== undefined && void api.browserAction(tabId, 'zoom-out'),
      },
      {
        id: 'zoom-reset',
        label: `重置缩放（${zoomLabel}）`,
        disabled,
        onSelect: () => tabId !== undefined && void api.browserAction(tabId, 'zoom-reset'),
      },
      { id: 'browser-menu-sep-2', separator: true },
      {
        id: 'fit-width',
        label: '适合宽度',
        icon: <Maximize2 size={14} />,
        checked: activeTab?.autoFit === true,
        disabled,
        onSelect: () => tabId !== undefined && void api.browserAction(tabId, 'fit'),
      },
    ];
  }, [
    activeTab?.autoFit,
    activeTab?.id,
    bookmarksOpen,
    zoomLabel,
  ]);

  const tabBar = useMemo(() => (
    <div className="workspace-rail-tab-bar browser-tabs" role="tablist">
      {tabs.map((tab, index) => (
        <button
          aria-selected={tab.id === activeId}
          className={tab.id === activeId ? 'active' : ''}
          key={tab.id}
          onAuxClick={(event) => {
            if (event.button === 1) {
              event.preventDefault();
              closeTab(tab.id);
            }
          }}
          onClick={() => {
            setActiveId(tab.id);
            setUrl(tab.url);
          }}
          role="tab"
          title={tab.title || tab.url}
          type="button"
        >
          {tab.loading ? <LoaderCircle className="spin" size={11} /> : <Globe2 size={11} />}
          <span>{tab.title || `标签 ${String(index + 1)}`}</span>
          <X
            size={10}
            onClick={(event) => {
              event.stopPropagation();
              closeTab(tab.id);
            }}
          />
        </button>
      ))}
      <button
        aria-label="新建浏览器标签"
        onClick={() => void createTab()}
        title="新建浏览器标签"
        type="button"
      >
        <Plus size={12} />
      </button>
      {props.embedded === true ? (
        <div className="workspace-rail-tab-bar__actions">
          <button
            aria-label="关闭浏览器面板"
            onClick={props.onClose}
            title="关闭浏览器面板"
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  ), [activeId, closeTab, createTab, props.embedded, props.onClose, tabs]);

  return (
    <>
      {props.embedded === true ? <WorkspaceRailChromeSlot>{tabBar}</WorkspaceRailChromeSlot> : null}
      <div className={`browser-panel${props.embedded === true ? ' browser-panel--rail' : ''}`}>
        {props.embedded !== true ? tabBar : null}
        <div className="browser-toolbar">
          <div className="browser-nav-bar">
            <div className="browser-nav-actions">
              <button aria-label="后退" disabled={!activeTab?.canGoBack} onClick={() => activeTab && void api.browserAction(activeTab.id, 'back')} title="后退" type="button"><ArrowLeft size={16} /></button>
              <button aria-label="前进" disabled={!activeTab?.canGoForward} onClick={() => activeTab && void api.browserAction(activeTab.id, 'forward')} title="前进" type="button"><ArrowRight size={16} /></button>
              <button aria-label="重新载入" disabled={activeTab === undefined} onClick={() => activeTab && void api.browserAction(activeTab.id, activeTab.loading ? 'stop' : 'reload')} title={activeTab?.loading ? '停止载入' : '重新载入'} type="button"><RefreshCw className={activeTab?.loading ? 'spin' : ''} size={16} /></button>
            </div>
            <form
              className="browser-address-bar"
              onSubmit={(event) => {
                event.preventDefault();
                if (activeTab) void api.browserNavigate(activeTab.id, url).catch((cause: unknown) => props.onError(messageOf(cause)));
              }}
            >
              <Globe2 aria-hidden className="browser-address-bar-icon" size={14} />
              <input aria-label="浏览器地址" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="搜索或输入网址" spellCheck={false} />
            </form>
            <div className="browser-toolbar-actions">
              <button
                aria-label={bookmarked ? '移除当前书签' : '收藏当前页面'}
                className={bookmarked ? 'active' : ''}
                disabled={activeTab === undefined || activeTab.url === 'about:blank'}
                onClick={bookmarkActive}
                title={bookmarked ? '移除当前书签' : '收藏当前页面'}
                type="button"
              >
                <Star fill={bookmarked ? 'currentColor' : 'none'} size={16} />
              </button>
              <button
                aria-expanded={browserMenuAnchor !== undefined}
                aria-haspopup="menu"
                aria-label="浏览器菜单"
                className={browserMenuAnchor !== undefined ? 'active' : ''}
                onClick={(event) => setBrowserMenuAnchor(anchorFromElement(event.currentTarget))}
                title="浏览器菜单"
                type="button"
              >
                <MoreVertical size={16} />
              </button>
            </div>
          </div>
          {feedback.length > 0 ? (
            <div aria-live="polite" className="browser-feedback-bar">{feedback}</div>
          ) : null}
        </div>
        {browserMenuAnchor !== undefined ? (
          <AppMenuPopover
            anchor={browserMenuAnchor}
            ariaLabel="浏览器菜单"
            items={browserMenuItems}
            onClose={() => setBrowserMenuAnchor(undefined)}
            placement="bottom-end"
          />
        ) : null}
      <div className="browser-bookmark-bar">
        {bookmarksOpen ? (
          <div className="browser-bookmark-bar__items">
            <Bookmark aria-hidden size={12} />
            {bookmarks.length === 0 ? <span className="browser-bookmark-bar__hint">点击星标收藏当前页面</span> : bookmarks.map((bookmark) => (
              <div className="browser-bookmark" key={bookmark.id}>
                <button className="browser-bookmark-link" onClick={() => activeTab && void api.browserNavigate(activeTab.id, bookmark.url)} title={bookmark.url} type="button"><Globe2 size={11} /><span>{bookmark.title}</span></button>
                <button aria-label={`删除书签 ${bookmark.title}`} className="browser-bookmark-remove" onClick={() => saveBookmarks(bookmarks.filter((item) => item.id !== bookmark.id))} title="删除书签" type="button"><X size={9} /></button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="browser-bookmark-bar__actions">
          <button
            aria-label="标注页面元素"
            className={annotating ? 'active' : ''}
            disabled={activeTab === undefined || annotating}
            onClick={() => void annotate()}
            title="标注元素"
            type="button"
          >
            {annotating ? <LoaderCircle className="spin" size={14} /> : <SquareDashedMousePointer size={14} />}
          </button>
          <button
            aria-label="保存页面截图"
            disabled={activeTab === undefined}
            onClick={captureScreenshot}
            title="截图"
            type="button"
          >
            <Camera size={14} />
          </button>
          <button
            aria-label="开发者工具"
            aria-pressed={activeTab?.devToolsOpen === true}
            className={activeTab?.devToolsOpen === true ? 'active' : ''}
            disabled={activeTab === undefined}
            onClick={() => activeTab && void api.browserAction(activeTab.id, 'devtools')}
            title="开发者工具"
            type="button"
          >
            <Code2 size={14} />
          </button>
        </div>
      </div>
      <div className="browser-viewport" ref={viewport}>
        {activeTab?.loading ? <LoaderCircle className="spin browser-loading" size={18} /> : null}
      </div>
      </div>
    </>
  );
}

function EmptyPanel({ icon, text }: { readonly icon: ReactNode; readonly text: string }): ReactNode {
  return <div className="empty-panel"><span>{icon}</span><p>{text}</p></div>;
}

function RoutePage(props: {
  readonly route: Exclude<Route, 'new' | 'chat'>;
  readonly activeProject?: ProjectSummary;
  readonly session?: SessionSnapshot;
  readonly settings?: AppSettings;
  readonly logFile?: string;
  readonly modelConfiguration?: ModelConfiguration;
  readonly inboxAutomationFilter?: string;
  readonly onSettings: (settings: AppSettings) => void;
  readonly onModelConfiguration: (configuration: ModelConfiguration) => void;
  readonly onOpenTask: (id: string) => void;
  readonly onViewInbox: (automationId: string) => void;
  readonly onOpenSettings: () => void;
  readonly onPreviewSite: (url: string) => void;
  readonly onError: (message: string) => void;
  readonly onProjectUpdated: (project: ProjectSummary) => void;
}): ReactNode {
  switch (props.route) {
    case 'inbox':
      return (
        <InboxPage
          onOpenTask={props.onOpenTask}
          onError={props.onError}
          initialAutomationId={props.inboxAutomationFilter}
        />
      );
    case 'scheduled':
      return (
        <ScheduledPage
          project={props.activeProject}
          onError={props.onError}
          onViewInbox={props.onViewInbox}
        />
      );
    case 'plugins':
      return (
        <PluginsPage
          session={props.session}
          project={props.activeProject}
          onError={props.onError}
          onOpenTask={props.onOpenTask}
        />
      );
    case 'sites':
      return <SitesPage onError={props.onError} onPreviewInBrowser={props.onPreviewSite} />;
    case 'pulls':
      return (
        <PullsPage
          project={props.activeProject}
          onError={props.onError}
          onProjectUpdated={props.onProjectUpdated}
          onOpenTask={props.onOpenTask}
        />
      );
    case 'git-sync':
      return <GitSyncPage project={props.activeProject} onError={props.onError} />;
    case 'memory':
      return props.settings === undefined ? null : (
        <MemoryPage
          project={props.activeProject}
          settings={props.settings}
          onError={props.onError}
          onOpenSettings={props.onOpenSettings}
        />
      );
    case 'settings':
      return (
        <SettingsPage
          settings={props.settings}
          logFile={props.logFile}
          modelConfiguration={props.modelConfiguration}
          onSettings={props.onSettings}
          onModelConfiguration={props.onModelConfiguration}
          onError={props.onError}
        />
      );
  }
}


interface SettingsTextDraft {
  readonly uiFont: string;
  readonly codeFont: string;
  readonly worktreeRoot: string;
  readonly terminalShell: string;
  readonly editorCommand: string;
  readonly browserAllowlist: string;
  readonly browserBlocklist: string;
  readonly computerAllowlist: string;
}

function ProjectIndexSettings(props: {
  readonly settings: AppSettings;
  readonly onSettings: (settings: AppSettings) => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [projects, setProjects] = useState<readonly ProjectSummary[]>([]);
  const [statuses, setStatuses] = useState<readonly IndexStatus[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    let alive = true;
    const refresh = (): void => {
      void Promise.all(projects.map((project) => api.indexStatus(project.workDir)))
        .then((next) => {
          if (alive) setStatuses(next);
        })
        .catch(() => {
          if (alive) setStatuses([]);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 2_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [projects]);

  const update = (patch: Partial<AppSettings>): void => {
    void api.setSettings(patch).then(props.onSettings).catch((cause) => props.onError(messageOf(cause)));
  };

  const upsertStatus = (next: IndexStatus): void => {
    setStatuses((current) => {
      const others = current.filter((item) => item.workDir !== next.workDir);
      return [...others, next];
    });
  };

  return (
    <SettingsSection icon={<Search />} title="项目索引">
      <p>
        本地索引路径、全文与语义检索，用于 @codebase 与 Agent 的代码库搜索。数据仅保存在本机，不会上传源码。
        可在项目根目录放置 <code>.ganymedeignore</code>（语法同 .gitignore）。打开主目录或超大文件夹时会先确认。
      </p>
      <label className="toggle">
        <input
          type="checkbox"
          checked={props.settings.indexEnabled}
          onChange={(event) => {
            const enabled = event.target.checked;
            void api
              .setSettings({ indexEnabled: enabled })
              .then(async (next) => {
                props.onSettings(next);
                if (!enabled) return;
                for (const project of projects.slice(0, 8)) {
                  await api
                    .activateProjectIndex(project.workDir, project.additionalDirs)
                    .then(upsertStatus)
                    .catch(() => undefined);
                }
              })
              .catch((cause) => props.onError(messageOf(cause)));
          }}
        />
        启用项目索引
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={props.settings.indexSemanticEnabled}
          disabled={!props.settings.indexEnabled}
          onChange={(event) => update({ indexSemanticEnabled: event.target.checked })}
        />
        启用本地语义向量（关闭后仅保留全文检索）
      </label>
      <label>
        单文件大小上限（字节）
        <input
          type="number"
          min={16_384}
          max={8_388_608}
          value={props.settings.indexMaxFileBytes}
          disabled={!props.settings.indexEnabled}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (!Number.isFinite(value)) return;
            update({ indexMaxFileBytes: Math.min(8_388_608, Math.max(16_384, Math.round(value))) });
          }}
        />
      </label>
      {projects.length === 0 ? (
        <p className="muted">打开项目后可在此查看索引进度并重建索引。</p>
      ) : (
        <div className="index-status-list">
          {projects.slice(0, 8).map((project) => {
            const status = statuses.find((item) => pathsEqual(item.workDir, project.workDir));
            const progress = status === undefined ? 0 : Math.round(status.progress * 100);
            const stateLabel =
              status === undefined
                ? '未激活'
                : status.state === 'blocked'
                  ? '待确认'
                  : status.state === 'indexing'
                    ? `索引中 ${String(progress)}%`
                    : `${status.state} · ${String(progress)}% · ${String(status.fileCount)} 文件 · ${String(status.chunkCount)} 块`;
            return (
              <div key={project.workDir} className="index-status-row">
                <div>
                  <strong>{project.name}</strong>
                  <span>{stateLabel}</span>
                </div>
                <div className="index-status-row-actions">
                  {status?.state === 'indexing' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void api
                          .cancelProjectIndex(project.workDir)
                          .then(upsertStatus)
                          .catch((cause) => props.onError(messageOf(cause)))
                          .finally(() => setBusy(false));
                      }}
                    >
                      停止
                    </button>
                  ) : null}
                  {status?.state === 'blocked' ? (
                    <button
                      type="button"
                      disabled={busy || !props.settings.indexEnabled}
                      onClick={() => {
                        setBusy(true);
                        const optOut = (props.settings.indexOptOutRoots ?? []).filter(
                          (root) => !pathsEqual(root, project.workDir),
                        );
                        void api
                          .setSettings({ indexOptOutRoots: optOut })
                          .then((next) => {
                            props.onSettings(next);
                            return forceActivateProjectIndex(
                              api,
                              project.workDir,
                              project.additionalDirs,
                            );
                          })
                          .then(upsertStatus)
                          .catch((cause) => props.onError(messageOf(cause)))
                          .finally(() => setBusy(false));
                      }}
                    >
                      确认索引
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || !props.settings.indexEnabled}
                      onClick={() => {
                        setBusy(true);
                        void api
                          .rebuildProjectIndex(project.workDir)
                          .then(upsertStatus)
                          .catch((cause) => props.onError(messageOf(cause)))
                          .finally(() => setBusy(false));
                      }}
                    >
                      重建索引
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingsSection>
  );
}

function pathsEqual(left: string, right: string): boolean {
  return left.replaceAll('\\', '/').replace(/\/+$/, '') === right.replaceAll('\\', '/').replace(/\/+$/, '');
}

function settingsTextDraft(settings: AppSettings): SettingsTextDraft {
  return {
    uiFont: settings.uiFont,
    codeFont: settings.codeFont,
    worktreeRoot: settings.worktreeRoot,
    terminalShell: settings.terminalShell ?? '',
    editorCommand: settings.editorCommand ?? '',
    browserAllowlist: settings.browserAllowlist.join(', '),
    browserBlocklist: settings.browserBlocklist.join(', '),
    computerAllowlist: settings.computerAllowlist.join(', '),
  };
}

function prepareSettingsPatch(patch: Partial<AppSettings>): Partial<AppSettings> {
  return {
    ...patch,
    uiFont: patch.uiFont !== undefined ? normalizeFontFamily(patch.uiFont) : patch.uiFont,
    codeFont: patch.codeFont !== undefined ? normalizeFontFamily(patch.codeFont) : patch.codeFont,
  };
}

function SettingsPage(props: {
  readonly settings?: AppSettings;
  readonly logFile?: string;
  readonly modelConfiguration?: ModelConfiguration;
  readonly onSettings: (settings: AppSettings) => void;
  readonly onModelConfiguration: (configuration: ModelConfiguration) => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [auth, setAuth] = useState<AuthStatus>();
  const [profileTasks, setProfileTasks] = useState<readonly TaskSummary[]>([]);
  const [draft, setDraft] = useState<SettingsTextDraft>();
  const pendingPatch = useRef<Partial<AppSettings>>({});
  const saveSeq = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSettingsRef = useRef(props.onSettings);
  const onErrorRef = useRef(props.onError);
  onSettingsRef.current = props.onSettings;
  onErrorRef.current = props.onError;

  useEffect(() => { void api.authStatus().then(setAuth).catch(() => setAuth(undefined)); }, []);
  useEffect(() => { void api.listSessions(undefined, true).then(setProfileTasks); }, []);
  useEffect(() => {
    if (props.settings === undefined) return;
    setDraft((current) => current ?? settingsTextDraft(props.settings!));
  }, [props.settings]);

  const flushTextSettings = useCallback(() => {
    if (debounceTimer.current !== undefined) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = undefined;
    }
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    if (Object.keys(patch).length === 0) return;
    const seq = ++saveSeq.current;
    void api.setSettings(prepareSettingsPatch(patch))
      .then((next) => {
        if (seq !== saveSeq.current) return;
        onSettingsRef.current(next);
      })
      .catch((cause: unknown) => {
        if (seq === saveSeq.current) onErrorRef.current(messageOf(cause));
      });
  }, []);

  useEffect(() => () => flushTextSettings(), [flushTextSettings]);

  const updateText = useCallback((
    draftPatch: Partial<SettingsTextDraft>,
    settingsPatch: Partial<AppSettings>,
  ): void => {
    setDraft((current) => (current === undefined ? current : { ...current, ...draftPatch }));
    pendingPatch.current = { ...pendingPatch.current, ...settingsPatch };
    if (debounceTimer.current !== undefined) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => flushTextSettings(), 300);
  }, [flushTextSettings]);

  if (props.settings === undefined || draft === undefined) return null;
  const authenticated = isAuthenticated(auth);
  const refreshAccountAndModels = (): Promise<void> =>
    Promise.all([api.authStatus(), api.modelConfiguration()]).then(([nextAuth, models]) => {
      setAuth(nextAuth);
      props.onModelConfiguration(models);
    });
  const update = (patch: Partial<AppSettings>): void => {
    void api.setSettings(patch).then(props.onSettings).catch((cause) => props.onError(messageOf(cause)));
  };
  return (
    <PageFrame icon={<Settings />} title="设置" subtitle="配置模型、外观、安全边界和本地工作环境。">
      <div className="settings-sections">
        <SettingsSection icon={<Sparkles />} title="本地 Profile">
          <div className="profile-metrics">
            <Metric label="历史任务" value={profileTasks.length} />
            <Metric label="活跃天数" value={new Set(profileTasks.map((task) => new Date(task.updatedAt).toDateString())).size} />
            <Metric label="项目" value={new Set(profileTasks.map((task) => task.workDir)).size} />
            <Metric label="最长任务" value={profileTasks.length === 0 ? '—' : formatDuration(Math.max(...profileTasks.map((task) => task.updatedAt - task.createdAt)))} />
          </div>
        </SettingsSection>
        <SettingsSection icon={<User />} title="Kimi 模型账号">
          <p>{describeAuthStatus(auth)}</p>
          <div>
            <button
              className="primary-button"
              disabled={authenticated}
              onClick={() => void api.authLogin().then(refreshAccountAndModels).catch((cause) => props.onError(messageOf(cause)))}
            >登录</button>
            <button
              disabled={!authenticated}
              onClick={() => void api.authLogout().then(refreshAccountAndModels).catch((cause) => props.onError(messageOf(cause)))}
            >退出</button>
          </div>
        </SettingsSection>
        <ModelConfigurationSettings
          configuration={props.modelConfiguration}
          onConfiguration={props.onModelConfiguration}
          onError={props.onError}
        />
        <SettingsSection icon={<MoonStar />} title="外观">
          <label>语言<select value={props.settings.locale} onChange={(event) => update({ locale: event.target.value as AppSettings['locale'] })}><option value="zh-CN">简体中文</option><option value="en-US">English</option></select></label>
          <label>主题<select value={props.settings.theme} onChange={(event) => update({ theme: event.target.value as AppSettings['theme'] })}><option value="dark">深色</option><option value="light">浅色</option><option value="system">跟随系统</option></select></label>
          <label>深色强调色<input type="color" value={props.settings.accentDark} onChange={(event) => update({ accentDark: event.target.value })} /></label>
          <label>浅色强调色<input type="color" value={props.settings.accentLight} onChange={(event) => update({ accentLight: event.target.value })} /></label>
          <label>
            UI 字体
            <input
              value={draft.uiFont}
              onChange={(event) => updateText({ uiFont: event.target.value }, { uiFont: event.target.value })}
              onBlur={() => flushTextSettings()}
              placeholder='Inter, "SF Pro Text", "PingFang SC", sans-serif'
            />
          </label>
          <label>
            代码 / 终端字体
            <input
              value={draft.codeFont}
              onChange={(event) => updateText({ codeFont: event.target.value }, { codeFont: event.target.value })}
              onBlur={() => flushTextSettings()}
              placeholder='"MesloLGS NF", Menlo, monospace'
            />
          </label>
          <label>
            终端字号
            <input
              type="number"
              min={10}
              max={24}
              value={props.settings.terminalFontSize}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                update({ terminalFontSize: Math.min(24, Math.max(10, Math.round(value))) });
              }}
            />
          </label>
        </SettingsSection>
        <SettingsSection icon={<MessageSquare />} title="任务行为">
          <label>
            运行中发送消息（兼容旧路径）
            <select
              value={props.settings.followUp}
              onChange={(event) => update({ followUp: event.target.value as AppSettings['followUp'] })}
            >
              <option value="queue">默认排队到下一轮（推荐）</option>
              <option value="steer">主进程立即 steer（桌面端已改用 ⌘/Ctrl+Enter）</option>
            </select>
          </label>
          <p className="settings-hint">
            桌面端运行中 Enter 一律排队；使用 ⌘/Ctrl+Enter（或队列中的闪电按钮）立即注入当前回合。
          </p>
          <label className="toggle"><input type="checkbox" checked={props.settings.notifications} onChange={(event) => update({ notifications: event.target.checked })} />完成时显示系统通知</label>
          <label className="toggle"><input type="checkbox" checked={props.settings.memoryEnabled} onChange={(event) => update({ memoryEnabled: event.target.checked })} />启用本地记忆</label>
        </SettingsSection>
        <ProjectIndexSettings settings={props.settings} onSettings={props.onSettings} onError={props.onError} />
        <SettingsSection icon={<FolderGit2 />} title="Worktree">
          <label>
            根目录
            <input
              value={draft.worktreeRoot}
              onChange={(event) => updateText({ worktreeRoot: event.target.value }, { worktreeRoot: event.target.value })}
              onBlur={() => flushTextSettings()}
            />
          </label>
          <label>保留数量<input type="number" min={1} max={100} value={props.settings.worktreeRetention} onChange={(event) => update({ worktreeRetention: Number(event.target.value) })} /></label>
        </SettingsSection>
        <SettingsSection icon={<TerminalSquare />} title="开发工具">
          <label>
            终端 Shell
            <input
              value={draft.terminalShell}
              onChange={(event) => updateText(
                { terminalShell: event.target.value },
                { terminalShell: event.target.value || undefined },
              )}
              onBlur={() => flushTextSettings()}
              placeholder="/bin/zsh"
            />
          </label>
          <label>
            外部编辑器
            <input
              value={draft.editorCommand}
              onChange={(event) => updateText(
                { editorCommand: event.target.value },
                { editorCommand: event.target.value || undefined },
              )}
              onBlur={() => flushTextSettings()}
              placeholder="cursor"
            />
          </label>
        </SettingsSection>
        <SettingsSection icon={<FileText />} title="诊断与日志">
          <label>
            日志级别
            <select
              value={props.settings.logLevel}
              onChange={(event) => update({ logLevel: event.target.value as AppSettings['logLevel'] })}
            >
              <option value="off">关闭</option>
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={props.settings.logMirrorConsole}
              onChange={(event) => update({ logMirrorConsole: event.target.checked })}
            />
            同步到控制台
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={props.settings.logIpcTrace}
              onChange={(event) => update({ logIpcTrace: event.target.checked })}
            />
            记录 IPC 追踪
          </label>
          {props.logFile !== undefined ? (
            <p className="settings-note">日志文件：{props.logFile}</p>
          ) : null}
          <div>
            <button type="button" onClick={() => void api.revealLogs().catch((cause) => props.onError(messageOf(cause)))}>
              打开日志目录
            </button>
          </div>
          <p className="settings-note">环境变量 GANYMEDE_LOG_LEVEL 会覆盖上述级别设置，便于临时调试。</p>
        </SettingsSection>
        <SettingsSection icon={<Globe2 />} title="浏览器权限">
          <label>
            允许交互的站点
            <input
              value={draft.browserAllowlist}
              onChange={(event) => updateText(
                { browserAllowlist: event.target.value },
                { browserAllowlist: splitList(event.target.value) },
              )}
              onBlur={() => flushTextSettings()}
              placeholder="localhost, example.com"
            />
          </label>
          <label>
            禁止访问的站点
            <input
              value={draft.browserBlocklist}
              onChange={(event) => updateText(
                { browserBlocklist: event.target.value },
                { browserBlocklist: splitList(event.target.value) },
              )}
              onBlur={() => flushTextSettings()}
              placeholder="example.test"
            />
          </label>
        </SettingsSection>
        <SettingsSection icon={<Bot />} title="Computer Use">
          <label>
            允许控制的应用
            <input
              value={draft.computerAllowlist}
              onChange={(event) => updateText(
                { computerAllowlist: event.target.value },
                { computerAllowlist: splitList(event.target.value) },
              )}
              onBlur={() => flushTextSettings()}
              placeholder="com.apple.Safari, Xcode"
            />
          </label>
          <p className="settings-note">还需在 macOS 隐私与安全性中授予 Screen Recording 与 Accessibility 权限。</p>
        </SettingsSection>
        <SettingsSection icon={<Globe2 />} title="SSH 连接">
          <SshProfiles profiles={props.settings.sshProfiles} onChange={(sshProfiles) => update({ sshProfiles })} />
        </SettingsSection>
      </div>
    </PageFrame>
  );
}

function ModelConfigurationSettings(props: {
  readonly configuration?: ModelConfiguration;
  readonly onConfiguration: (configuration: ModelConfiguration) => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [catalog, setCatalog] = useState<readonly CatalogProviderOption[]>();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [modelId, setModelId] = useState('');
  const [thinking, setThinking] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const configuredModel = props.configuration?.models.find(
    (model) => model.id === props.configuration?.defaultModel,
  );
  const selectedProvider = catalog?.find((provider) => provider.id === providerId);
  const selectedCatalogModel = selectedProvider?.models.find((model) => model.id === modelId);

  const configure = (model: string, effort: string): void => {
    setSaving(true);
    void api.configureDefaultModel({ model, thinking: effort })
      .then(props.onConfiguration)
      .catch((cause: unknown) => props.onError(messageOf(cause)))
      .finally(() => setSaving(false));
  };

  const selectCatalogProvider = (
    provider: CatalogProviderOption | undefined,
  ): void => {
    setProviderId(provider?.id ?? '');
    const model = provider?.models[0];
    setModelId(model?.id ?? '');
    setThinking(model?.defaultThinking ?? '');
  };

  const openCatalog = (): void => {
    if (catalog !== undefined) {
      setCatalogOpen(true);
      if (providerId.length === 0) selectCatalogProvider(catalog[0]);
      return;
    }
    setCatalogLoading(true);
    void api.listModelCatalog()
      .then((providers) => {
        setCatalog(providers);
        setCatalogOpen(true);
        selectCatalogProvider(providers[0]);
      })
      .catch((cause: unknown) => props.onError(messageOf(cause)))
      .finally(() => setCatalogLoading(false));
  };

  const addProvider = (): void => {
    if (selectedProvider === undefined || selectedCatalogModel === undefined) return;
    setSaving(true);
    void api.addCatalogProvider({
      providerId: selectedProvider.id,
      apiKey,
      model: selectedCatalogModel.id,
      thinking,
    })
      .then((configuration) => {
        props.onConfiguration(configuration);
        setApiKey('');
        setCatalogOpen(false);
      })
      .catch((cause: unknown) => props.onError(messageOf(cause)))
      .finally(() => setSaving(false));
  };

  return (
    <SettingsSection icon={<Brain />} title="模型与思考">
      {props.configuration === undefined || props.configuration.models.length === 0 ? (
        <p>尚未配置模型。可登录 Kimi 模型账号，或从兼容目录添加第三方模型服务。</p>
      ) : (
        <>
          <label>
            默认模型
            <select
              disabled={saving}
              value={props.configuration.defaultModel ?? ''}
              onChange={(event) => {
                const model = props.configuration?.models.find(
                  (option) => option.id === event.target.value,
                );
                if (model !== undefined) configure(model.id, model.defaultThinking);
              }}
            >
              <option disabled value="">选择模型</option>
              {props.configuration.models.map((model) => (
                <option key={model.id} value={model.id}>{model.label} · {model.provider}</option>
              ))}
            </select>
          </label>
          <label>
            思考档位
            <select
              disabled={saving || configuredModel === undefined}
              value={props.configuration.defaultThinking ?? configuredModel?.defaultThinking ?? ''}
              onChange={(event) => {
                if (configuredModel !== undefined) configure(configuredModel.id, event.target.value);
              }}
            >
              {configuredModel?.thinkingEfforts.map((effort) => (
                <option key={effort} value={effort}>
                  {thinkingLabel(effort)}{effort === configuredModel.defaultThinking ? '（模型默认）' : ''}
                </option>
              ))}
            </select>
          </label>
          <p>
            可用 {String(props.configuration.models.length)} 个模型；切换模型时会同时校验并应用其支持的思考档位。
          </p>
        </>
      )}
      <div>
        <button
          className="primary-button"
          disabled={catalogLoading || saving}
          onClick={openCatalog}
          type="button"
        >
          {catalogLoading ? '正在载入目录…' : '添加模型服务'}
        </button>
      </div>
      {catalogOpen ? (
        <div className="model-provider-form">
          <label>
            模型服务
            <select
              value={providerId}
              onChange={(event) => selectCatalogProvider(
                catalog?.find((provider) => provider.id === event.target.value),
              )}
            >
              {catalog?.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.label}</option>
              ))}
            </select>
          </label>
          <label>
            模型
            <select
              value={modelId}
              onChange={(event) => {
                const model = selectedProvider?.models.find(
                  (option) => option.id === event.target.value,
                );
                setModelId(model?.id ?? '');
                setThinking(model?.defaultThinking ?? '');
              }}
            >
              {selectedProvider?.models.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
          </label>
          <label>
            思考档位
            <select value={thinking} onChange={(event) => setThinking(event.target.value)}>
              {selectedCatalogModel?.thinkingEfforts.map((effort) => (
                <option key={effort} value={effort}>{thinkingLabel(effort)}</option>
              ))}
            </select>
          </label>
          <label>
            API Key
            <input
              autoComplete="off"
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={selectedProvider?.env[0] ?? 'YOUR_API_KEY'}
              type="password"
              value={apiKey}
            />
          </label>
          {selectedProvider?.baseUrl !== undefined ? (
            <p className="settings-note">接口地址：{selectedProvider.baseUrl}</p>
          ) : null}
          <div>
            <button type="button" onClick={() => { setCatalogOpen(false); setApiKey(''); }}>取消</button>
            <button
              className="primary-button"
              disabled={saving || apiKey.trim().length === 0 || thinking.length === 0}
              onClick={addProvider}
              type="button"
            >
              {saving ? '正在保存…' : '保存并设为默认'}
            </button>
          </div>
        </div>
      ) : null}
    </SettingsSection>
  );
}

function SettingsSection(props: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
}): ReactNode {
  return <section className="settings-section"><h2>{props.icon}{props.title}</h2>{props.children}</section>;
}

function SshProfiles(props: {
  readonly profiles: AppSettings['sshProfiles'];
  readonly onChange: (profiles: AppSettings['sshProfiles']) => void;
}): ReactNode {
  const [draft, setDraft] = useState({
    label: '',
    host: '',
    port: 22,
    username: '',
    remotePath: '',
    keyPath: `${String((navigator.userAgent.includes('Mac') ? '~/.ssh/id_ed25519' : ''))}`,
  });
  return (
    <div className="ssh-profiles">
      {props.profiles.map((profile) => (
        <div className="ssh-profile" key={profile.id}>
          <Globe2 size={14} />
          <span><strong>{profile.label}</strong><small>{profile.username}@{profile.host}:{profile.port} · {profile.remotePath}</small></span>
          <button aria-label={`删除 SSH 配置 ${profile.label}`} onClick={() => props.onChange(props.profiles.filter((item) => item.id !== profile.id))} title="删除 SSH 配置"><Trash2 size={13} /></button>
        </div>
      ))}
      <div className="ssh-form">
        <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="名称" />
        <input value={draft.host} onChange={(event) => setDraft({ ...draft, host: event.target.value })} placeholder="主机" />
        <input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} placeholder="用户" />
        <input value={draft.remotePath} onChange={(event) => setDraft({ ...draft, remotePath: event.target.value })} placeholder="/remote/project" />
        <input value={draft.keyPath} onChange={(event) => setDraft({ ...draft, keyPath: event.target.value })} placeholder="~/.ssh/id_ed25519" />
        <button className="primary-button" disabled={!draft.label || !draft.host || !draft.username || !draft.remotePath} onClick={() => {
          props.onChange([...props.profiles, {
            id: crypto.randomUUID(),
            label: draft.label,
            host: draft.host,
            port: draft.port,
            username: draft.username,
            remotePath: draft.remotePath,
            keyPaths: draft.keyPath ? [draft.keyPath] : [],
            trustUnknownHost: true,
          }]);
          setDraft({ ...draft, label: '', host: '', remotePath: '' });
        }}>添加连接</button>
      </div>
      <small className="settings-note">首次连接允许 TOFU；生产使用前应在配置中固定 SHA-256 主机指纹。</small>
    </div>
  );
}

function EmptyState(props: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly body: string;
  readonly action?: ReactNode;
}): ReactNode {
  return (
    <div className="empty-state">
      <span>{props.icon}</span>
      <strong>{props.title}</strong>
      <p>{props.body}</p>
      {props.action}
    </div>
  );
}

function ApprovalModal(props: {
  readonly request: PendingApproval;
  readonly onResolve: (resolution: ApprovalResolutionInput) => void;
}): ReactNode {
  const [feedback, setFeedback] = useState('');
  return (
    <Modal title="需要你的批准" onClose={() => props.onResolve({ id: props.request.id, decision: 'cancelled' })}>
      <div className="approval-title"><span><Command size={18} /></span><div><strong>{props.request.toolName}</strong><p>{props.request.action}</p></div></div>
      {props.request.display !== undefined ? <pre className="approval-display">{JSON.stringify(props.request.display, null, 2)}</pre> : null}
      <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="可选：给代理反馈或拒绝原因" />
      <div className="modal-actions">
        <button onClick={() => props.onResolve({ id: props.request.id, decision: 'rejected', feedback })}>拒绝</button>
        <button onClick={() => props.onResolve({ id: props.request.id, decision: 'approved', scope: 'session', feedback, selectedLabel: 'Approve for session' })}>本任务始终允许</button>
        <button className="primary-button" onClick={() => props.onResolve({ id: props.request.id, decision: 'approved', scope: 'once', feedback, selectedLabel: 'Approve once' })}>允许一次</button>
      </div>
    </Modal>
  );
}

type ApprovalResolutionInput = Parameters<typeof api.resolveApproval>[0];

function Modal(props: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return <div className="modal-backdrop"><div className="modal"><header><strong>{props.title}</strong><button aria-label="关闭" onClick={props.onClose} title="关闭"><X size={16} /></button></header><div className="modal-body">{props.children}</div></div></div>;
}

function RenameSheet(props: {
  readonly initialValue: string;
  readonly onClose: () => void;
  readonly onRename: (title: string) => void;
}): ReactNode {
  const [title, setTitle] = useState(props.initialValue);
  return (
    <Modal title="重命名任务" onClose={props.onClose}>
      <form className="sheet-form" onSubmit={(event) => {
        event.preventDefault();
        const next = title.trim();
        if (next.length > 0) props.onRename(next);
      }}>
        <input autoFocus maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} />
        <div className="modal-actions">
          <button type="button" onClick={props.onClose}>取消</button>
          <button className="primary-button" disabled={title.trim().length === 0} type="submit">重命名</button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmSheet(props: {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}): ReactNode {
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div className="confirm-sheet">
        <p>{props.body}</p>
        <div className="modal-actions">
          <button onClick={props.onClose}>取消</button>
          <button className={props.danger ? 'danger-button' : 'primary-button'} onClick={props.onConfirm}>{props.confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}

type CommandPaletteResult =
  | { readonly kind: 'task'; readonly task: TaskSummary }
  | { readonly kind: 'command'; readonly command: DesktopCommand };

function CommandPalette(props: {
  readonly onClose: () => void;
  readonly commands: readonly DesktopCommand[];
  readonly projects: readonly ProjectSummary[];
  readonly tasks: readonly TaskSummary[];
  readonly onTask: (task: TaskSummary) => void;
}): ReactNode {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const needle = query.trim();
  const matchedTasks = needle.length === 0
    ? []
    : props.tasks
        .filter((task) => fuzzyTextMatch(`${task.title} ${task.lastPrompt ?? ''}`, needle))
        .slice(0, 12);
  const matchedCommands = props.commands.filter((item) =>
    fuzzyTextMatch(`${item.slash} ${item.label} ${item.description}`, query),
  );
  const results: readonly CommandPaletteResult[] = [
    ...matchedTasks.map((task): CommandPaletteResult => ({ kind: 'task', task })),
    ...matchedCommands.map((command): CommandPaletteResult => ({ kind: 'command', command })),
  ];
  const activeIndex = Math.min(selectedIndex, Math.max(results.length - 1, 0));
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const selectResult = (result: CommandPaletteResult): void => {
    if (result.kind === 'task') props.onTask(result.task);
    else {
      result.command.onSelect();
      props.onClose();
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const active = results[activeIndex];
      if (active !== undefined) selectResult(active);
    }
  };

  return (
    <div className="command-backdrop" role="dialog" aria-modal="true" aria-label="命令面板" onMouseDown={props.onClose}>
      <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-input"><Search size={16} /><input aria-label="搜索任务或命令" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder="搜索任务或命令…" /><kbd>esc</kbd></div>
        <div className="command-results">
          {matchedTasks.length > 0 ? <div className="command-group-label">任务</div> : null}
          {matchedTasks.map((task, taskIndex) => {
            const index = taskIndex;
            const projectName = props.projects.find((project) => project.workDir === task.workDir)?.name ?? task.workDir;
            const detail = [
              projectName,
              task.archived ? '已归档' : undefined,
              task.lastPrompt ?? formatRelative(task.updatedAt),
            ].filter((part): part is string => part !== undefined).join(' · ');
            return (
              <button
                className={index === activeIndex ? 'active' : undefined}
                key={`task:${task.id}`}
                onClick={() => selectResult({ kind: 'task', task })}
                onMouseEnter={() => { setSelectedIndex(index); }}
              >
                <span><MessageSquare size={16} /></span>
                <span><strong>{task.title}</strong><small>{detail}</small></span>
              </button>
            );
          })}
          {matchedTasks.length > 0 && matchedCommands.length > 0 ? (
            <div className="command-group-label">命令</div>
          ) : null}
          {matchedCommands.map((item, commandIndex) => {
            const index = matchedTasks.length + commandIndex;
            return (
              <button
                className={index === activeIndex ? 'active' : undefined}
                key={item.slash}
                onClick={() => selectResult({ kind: 'command', command: item })}
                onMouseEnter={() => { setSelectedIndex(index); }}
              >
                <span>{item.icon}</span>
                <span><strong>{item.label}</strong><small>/{item.slash} · {item.description}</small></span>
                {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Toast(props: { readonly message: string; readonly onClose: () => void }): ReactNode {
  return <div className="toast" role="alert"><X size={15} /><span>{props.message}</span><button aria-label="关闭错误提示" onClick={props.onClose} title="关闭"><X size={13} /></button></div>;
}

function skillSlashCommand(skill: SkillView): string {
  return skill.source === 'builtin' || skill.isSubSkill ? skill.name : `skill:${skill.name}`;
}

function backgroundTaskStatusLabel(status: BackgroundTaskView['status']): string {
  return {
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    timed_out: '已超时',
    killed: '已停止',
    lost: '已丢失',
  }[status];
}

function storedNumber(key: string, fallback: number): number {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function storedBoolean(key: string, fallback: boolean): boolean {
  const value = window.localStorage.getItem(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function readBrowserBookmarks(): readonly BrowserBookmarkItem[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem('ganymede.browserBookmarks') ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];
      const record = item as Record<string, unknown>;
      return typeof record['id'] === 'string' &&
        typeof record['title'] === 'string' &&
        typeof record['url'] === 'string'
        ? [{ id: record['id'], title: record['title'], url: record['url'] }]
        : [];
    });
  } catch {
    return [];
  }
}

function browserPageTitle(tab: BrowserTab): string {
  if (tab.title.length > 0 && tab.title !== 'Browser') return tab.title;
  try {
    return new URL(tab.url).hostname || tab.url;
  } catch {
    return tab.url;
  }
}

function beginHorizontalResize(
  startCoordinate: number,
  startSize: number,
  direction: 1 | -1,
  minimum: number,
  maximum: number,
  preview: (value: number) => void,
  commit: (value: number) => void,
  storageKey: string,
): void {
  let latest = startSize;
  let frame: number | undefined;
  document.body.classList.add('resizing-horizontal');
  const cleanup = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    document.body.classList.remove('resizing-horizontal');
  };
  const onMove = (event: PointerEvent): void => {
    latest = Math.max(minimum, Math.min(maximum, startSize + (event.clientX - startCoordinate) * direction));
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      preview(latest);
    });
  };
  const onUp = (): void => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    preview(latest);
    commit(latest);
    cleanup();
    window.localStorage.setItem(storageKey, String(Math.round(latest)));
  };
  const onCancel = (): void => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    preview(startSize);
    cleanup();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
  window.addEventListener('pointercancel', onCancel, { once: true });
}

function beginVerticalResize(
  startCoordinate: number,
  startSize: number,
  minimum: number,
  maximum: number,
  preview: (value: number) => void,
  commit: (value: number) => void,
  storageKey: string,
): void {
  let latest = startSize;
  let frame: number | undefined;
  document.body.classList.add('resizing-vertical');
  const cleanup = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    document.body.classList.remove('resizing-vertical');
  };
  const onMove = (event: PointerEvent): void => {
    latest = Math.max(minimum, Math.min(maximum, startSize - (event.clientY - startCoordinate)));
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      preview(latest);
    });
  };
  const onUp = (): void => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    preview(latest);
    commit(latest);
    cleanup();
    window.localStorage.setItem(storageKey, String(Math.round(latest)));
  };
  const onCancel = (): void => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    preview(startSize);
    cleanup();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
  window.addEventListener('pointercancel', onCancel, { once: true });
}

function timeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 6) return '夜深了，灵感还醒着吗？';
  if (hour < 11) return '早上好，今天想完成什么？';
  if (hour < 14) return '中午好，继续把想法变成现实';
  if (hour < 18) return '下午好，一起推进手头的工作';
  return '晚上好呀，今天辛苦啦';
}

function formatRelative(timestamp: number): string {
  const delta = timestamp - Date.now();
  const absolute = Math.abs(delta);
  if (!Number.isFinite(timestamp)) return '不再运行';
  if (absolute < 60_000) return delta > 0 ? '不到 1 分钟后' : '刚刚';
  if (absolute < 3_600_000) return `${Math.round(absolute / 60_000)} 分钟${delta > 0 ? '后' : '前'}`;
  if (absolute < 86_400_000) return `${Math.round(absolute / 3_600_000)} 小时${delta > 0 ? '后' : '前'}`;
  return new Date(timestamp).toLocaleDateString();
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  if (minutes < 60) return `${String(minutes)} 分钟`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)} 小时`;
  return `${String(Math.round(hours / 24))} 天`;
}

function splitList(value: string): readonly string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function toolArgsPath(args: unknown): string | undefined {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return undefined;
  const record = args as Record<string, unknown>;
  const path = record['path'] ?? record['file_path'] ?? record['filePath'];
  return typeof path === 'string' && path.length > 0 ? path : undefined;
}

const systemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');
let latestThemeSettings: AppSettings | undefined;

systemThemeQuery.addEventListener('change', () => {
  if (latestThemeSettings !== undefined && document.documentElement.dataset['themeSource'] === 'system') {
    applyTheme(latestThemeSettings);
  }
});

function applyTheme(settings: AppSettings): void {
  latestThemeSettings = settings;
  const prefersLight = systemThemeQuery.matches;
  document.documentElement.dataset['themeSource'] = settings.theme;
  document.documentElement.dataset['theme'] = resolveThemeMode(settings, prefersLight);
  const accent = resolveAccentColor(settings, prefersLight);
  document.documentElement.style.setProperty('--accent', accent);
  const accentRgb = hexToRgbTriplet(accent);
  if (accentRgb !== undefined) {
    document.documentElement.style.setProperty('--accent-rgb', accentRgb);
  }
  document.documentElement.style.setProperty('--font-ui', normalizeFontFamily(settings.uiFont));
  document.documentElement.style.setProperty('--font-mono', normalizeFontFamily(settings.codeFont));
}

function applyShellStyle(shellStyle: BootstrapInfo['shellStyle']): void {
  document.documentElement.dataset['shell'] = shellStyle;
}

function downloadDataUrl(data: string, name: string): void {
  const anchor = document.createElement('a');
  anchor.href = data;
  anchor.download = name;
  anchor.click();
}

function isRoute(value: string): value is Route {
  return [
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
  ].includes(value);
}
