import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
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
  GitCommit,
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
  Mic,
  MoonStar,
  MoreHorizontal,
  Paperclip,
  PanelBottom,
  PanelRight,
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
  AuthStatus,
  Automation,
  BackgroundTaskView,
  BootstrapInfo,
  BrowserAnnotation,
  BrowserTab,
  CatalogProviderOption,
  EventEnvelope,
  FileContent,
  FileEntry,
  GitStatus,
  InboxItem,
  InteractionMode,
  McpServerView,
  MemoryRecord,
  ModelConfiguration,
  ModelOption,
  PathSuggestion,
  PendingApproval,
  PendingQuestion,
  PluginCommandView,
  PluginView,
  ProjectSummary,
  PromptAttachment,
  PromptReference,
  PullRequestSummary,
  PullRequestDetail,
  SessionSnapshot,
  SessionStatusView,
  SiteRecord,
  SkillView,
  TaskSummary,
  TerminalInfo,
} from '../shared/contracts';
import { INTERACTION_MODE_LABELS, resolveInteractionMode } from '../shared/contracts';
import {
  describeAuthStatus,
  isAuthenticated,
  pullRequestErrorMessage,
} from './presentation';
import { reduceLiveEvent, replayTimeline, type TimelineEntry } from './timeline';
import {
  AppMenuPopover,
  anchorFromElement,
  type AppMenuItem,
  type MenuAnchor,
} from './app-menu';
import {
  composerTriggerAt,
  fuzzyTextMatch,
  removeComposerTrigger,
  type ComposerTrigger,
  type TriggerContext,
} from './composer-support';
import {
  DEFAULT_MONO_FONT,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_XTERM_THEME,
  normalizeFontFamily,
  readTerminalThemeFromDocument,
  resolveMonoFont,
  resolveTerminalFontSize,
} from './terminal-options';

type Route =
  | 'new'
  | 'inbox'
  | 'scheduled'
  | 'plugins'
  | 'sites'
  | 'pulls'
  | 'chat'
  | 'memory'
  | 'settings';
type Panel = 'none' | 'summary' | 'review' | 'files' | 'terminal' | 'browser' | 'agents';

interface DesktopCommand {
  readonly slash: string;
  readonly label: string;
  readonly description: string;
  readonly icon: ReactNode;
  readonly shortcut?: string;
  readonly onSelect: () => void;
}

const api = window.ganymede;

export function App(): ReactNode {
  const [boot, setBoot] = useState<BootstrapInfo>();
  const [settings, setSettings] = useState<AppSettings>();
  const [projects, setProjects] = useState<readonly ProjectSummary[]>([]);
  const [tasks, setTasks] = useState<readonly TaskSummary[]>([]);
  const [referenceTasks, setReferenceTasks] = useState<readonly TaskSummary[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectSummary>();
  const [session, setSession] = useState<SessionSnapshot>();
  const [timeline, setTimeline] = useState<readonly TimelineEntry[]>([]);
  const [route, setRoute] = useState<Route>('new');
  const [panel, setPanel] = useState<Panel>('none');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => storedNumber('ganymede.sidebarWidth', 248));
  const [sidePanelWidth, setSidePanelWidth] = useState(() => storedNumber('ganymede.sidePanelWidth', 420));
  const [browserPanelWidth, setBrowserPanelWidth] = useState(() => storedNumber('ganymede.browserPanelWidth', 640));
  const [terminalHeight, setTerminalHeight] = useState(() => storedNumber('ganymede.terminalHeight', 250));
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<readonly PromptAttachment[]>([]);
  const [references, setReferences] = useState<readonly PromptReference[]>([]);
  const [approval, setApproval] = useState<PendingApproval>();
  const [question, setQuestion] = useState<PendingQuestion>();
  const [error, setError] = useState<string>();
  const [commandOpen, setCommandOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [target, setTarget] = useState<'local' | 'worktree' | 'ssh'>('local');
  const [sshProfileId, setSshProfileId] = useState<string>();
  const [draftInteractionMode, setDraftInteractionMode] = useState<InteractionMode>('agent');
  const [draftModel, setDraftModel] = useState<string>();
  const [draftThinking, setDraftThinking] = useState<string>();
  const [availableSkills, setAvailableSkills] = useState<readonly SkillView[]>([]);
  const [pluginCommands, setPluginCommands] = useState<readonly PluginCommandView[]>([]);
  const [renameTarget, setRenameTarget] = useState<{ readonly id: string; readonly title: string }>();
  const [removeProjectTarget, setRemoveProjectTarget] = useState<ProjectSummary>();
  const activeSessionId = useRef<string | undefined>(undefined);
  const statusRef = useRef<SessionStatusView | undefined>(undefined);
  statusRef.current = session?.status;

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

  const refreshProjects = useCallback(async () => {
    const next = await api.listProjects();
    setProjects(next);
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
        if (event.sessionId === activeSessionId.current) {
          const debugMode =
            statusRef.current?.interactionMode === 'debug' ||
            statusRef.current?.debugMode === true;
          setTimeline((entries) => reduceLiveEvent(entries, event, { debugMode }));
          setSession((current) =>
            current?.id === event.sessionId
              ? {
                  ...current,
                  status: patchStatusFromEvent(current.status, event.event),
                }
              : current,
          );
        }
      }),
      api.onApproval((request) => {
        if (alive) setApproval(request);
      }),
      api.onQuestion((request) => {
        if (alive) setQuestion(request);
      }),
      api.onAutomationState(() => {
        // Individual pages refresh after their own mutations; this signal is
        // retained for future badges without re-running application bootstrap.
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
        const listed = await refreshProjects();
        if (!alive) return;
        const first = listed[0];
        if (first !== undefined) {
          setActiveProject(first);
          await refreshTasks(first.workDir);
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
      if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'p')) {
        event.preventDefault();
        setCommandOpen(true);
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault();
        setSidebarOpen((value) => !value);
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'j') {
        event.preventDefault();
        setPanel((value) => (value === 'terminal' ? 'none' : 'terminal'));
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault();
        void startNewTask();
      } else if (event.key === 'Escape') {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  async function chooseProject(): Promise<void> {
    try {
      const project = await api.openProject();
      if (project === undefined) return;
      setActiveProject(project);
      setSession(undefined);
      setTimeline([]);
      setRoute('new');
      await Promise.all([refreshProjects(), refreshTasks(project.workDir)]);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function selectProject(project: ProjectSummary): Promise<void> {
    setActiveProject(project);
    setSession(undefined);
    setTimeline([]);
    setRoute('new');
    setPanel('none');
    await refreshTasks(project.workDir);
  }

  async function openTask(task: TaskSummary): Promise<void> {
    try {
      setLoading(true);
      const snapshot = await api.resumeSession(task.id);
      setSession(snapshot);
      setActiveProject(
        projects.find((project) => project.workDir === task.workDir) ?? activeProject,
      );
      setTimeline(replayTimeline(snapshot.replay, snapshot.liveEvents, {
        debugMode: snapshot.status.interactionMode === 'debug',
      }));
      setDraftInteractionMode(snapshot.status.interactionMode);
      setRoute('new');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  async function startNewTask(mode: InteractionMode = 'agent'): Promise<void> {
    setSession(undefined);
    setTimeline([]);
    setPrompt('');
    setAttachments([]);
    setReferences([]);
    setRoute('new');
    setDraftInteractionMode(mode);
    setDraftModel(boot?.defaultModel);
    setDraftThinking(boot?.defaultThinking);
    setPanel('none');
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
      permission: 'manual',
      interactionMode: draftInteractionMode,
      target,
      sshProfileId,
      additionalDirs: activeProject?.additionalDirs,
    });
    setSession(current);
    setDraftInteractionMode(current.status.interactionMode);
    setTimeline(
      replayTimeline(current.replay, current.liveEvents, {
        debugMode: current.status.interactionMode === 'debug',
      }),
    );
    return current;
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
        const skill = skillReferences[0]!;
        setTimeline((entries) => [
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
      const optimistic: TimelineEntry = {
        id: `user:${Date.now().toString()}`,
        kind: 'user',
        content:
          trimmed ||
          [...attachments.map((item) => item.name), ...references.map(referenceLabel)].join(', '),
      };
      setTimeline((entries) => [...entries, optimistic]);
      setPrompt('');
      const toSend = attachments;
      const referencesToSend = references;
      setAttachments([]);
      setReferences([]);
      await api.prompt({
        sessionId: current.id,
        text: trimmed,
        attachments: toSend,
        references: referencesToSend,
      });
      setSession((value) =>
        value === undefined ? value : { ...value, status: { ...value.status, running: true } },
      );
      await Promise.all([refreshProjects(), refreshTasks(activeProject?.workDir)]);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSending(false);
    }
  }

  async function changeRoute(next: Route): Promise<void> {
    setRoute(next);
    setPanel('none');
    if (next === 'new') await startNewTask();
    if (next === 'chat') await startNewTask('ask');
    if (next === 'pulls' && activeProject === undefined) setError('请先选择一个 Git 项目。');
  }

  async function pickAttachments(): Promise<void> {
    const next = await api.pickAttachments();
    setAttachments((current) => [
      ...current,
      ...next.filter((candidate) => current.every((item) => item.path !== candidate.path)),
    ]);
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
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
    });
  }

  async function applyInteractionMode(mode: InteractionMode): Promise<void> {
    setDraftInteractionMode(mode);
    setRoute('new');
    if (session === undefined) return;
    const status = await api.configureSession(session.id, { interactionMode: mode });
    setSession((current) =>
      current === undefined ? current : { ...current, status },
    );
    setDraftInteractionMode(status.interactionMode);
  }

  async function forkTask(id: string, workDir?: string): Promise<void> {
    try {
      const snapshot = await api.forkSession(id, workDir);
      setSession(snapshot);
      setTimeline(replayTimeline(snapshot.replay, snapshot.liveEvents, {
        debugMode: snapshot.status.interactionMode === 'debug',
      }));
      setDraftInteractionMode(snapshot.status.interactionMode);
      setRoute('new');
      await Promise.all([refreshProjects(), refreshTasks()]);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function runSlashCommand(text: string): Promise<boolean> {
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
      setPanel(command);
    } else if (command === 'agent') await applyInteractionMode('agent');
    else if (command === 'chat') await applyInteractionMode('ask');
    else if (command === 'plan') await applyInteractionMode('plan');
    else if (command === 'debug') await applyInteractionMode('debug');
    else if (command === 'multitask') await applyInteractionMode('multitask');
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
        setTimeline((entries) => [
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

  const filteredTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) return tasks;
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(needle) ||
        task.lastPrompt?.toLowerCase().includes(needle),
    );
  }, [search, tasks]);

  const commands: readonly DesktopCommand[] = [
    { slash: 'new', label: '新建任务', description: '在当前项目中开始新任务', icon: <Plus />, shortcut: '⌘N', onSelect: () => void runSlashCommand('/new') },
    { slash: 'open', label: '打开项目', description: '从磁盘选择工作目录', icon: <FolderOpen />, shortcut: '⌘O', onSelect: () => void runSlashCommand('/open') },
    { slash: 'help', label: '命令面板', description: '查看 Ganymede 可用命令', icon: <Command />, shortcut: '⌘K', onSelect: () => void runSlashCommand('/help') },
    { slash: 'settings', label: '设置', description: '模型、外观与本地环境', icon: <Settings />, shortcut: '⌘,', onSelect: () => void runSlashCommand('/settings') },
    { slash: 'skills', label: '技能与插件', description: '管理技能、插件和 MCP', icon: <WandSparkles />, onSelect: () => void runSlashCommand('/skills') },
    { slash: 'inbox', label: '收件箱', description: '查看自动化运行结果', icon: <Inbox />, onSelect: () => void runSlashCommand('/inbox') },
    { slash: 'scheduled', label: '已安排', description: '管理计划任务', icon: <Clock3 />, onSelect: () => void runSlashCommand('/scheduled') },
    { slash: 'sites', label: 'Sites', description: '预览与托管本地站点', icon: <Globe2 />, onSelect: () => void runSlashCommand('/sites') },
    { slash: 'pulls', label: '拉取请求', description: '查看当前项目的 PR', icon: <GitPullRequest />, onSelect: () => void runSlashCommand('/pulls') },
    { slash: 'memory', label: '记忆', description: '搜索项目记忆', icon: <Brain />, onSelect: () => void runSlashCommand('/memory') },
    { slash: 'files', label: '文件', description: '打开文件面板', icon: <FileText />, onSelect: () => void runSlashCommand('/files') },
    { slash: 'review', label: '审查', description: '打开代码审查面板', icon: <FileDiff />, onSelect: () => void runSlashCommand('/review') },
    { slash: 'terminal', label: '终端', description: '切换底部终端', icon: <TerminalSquare />, shortcut: '⌘J', onSelect: () => void runSlashCommand('/terminal') },
    { slash: 'browser', label: '浏览器', description: '打开应用内浏览器', icon: <Globe2 />, onSelect: () => void runSlashCommand('/browser') },
    { slash: 'summary', label: '任务摘要', description: '查看当前任务信息', icon: <Sparkles />, onSelect: () => void runSlashCommand('/summary') },
    { slash: 'agents', label: 'Agent 集群', description: '查看并控制并行 Agent 与后台任务', icon: <Boxes />, onSelect: () => void runSlashCommand('/agents') },
    { slash: 'agent', label: '助理模式', description: '执行完整的软件开发任务', icon: <Bot />, onSelect: () => void runSlashCommand('/agent') },
    { slash: 'chat', label: '聊天模式', description: '围绕当前项目讨论与问答', icon: <MessageCircle />, onSelect: () => void runSlashCommand('/chat') },
    { slash: 'plan', label: '计划模式', description: '先分析并制定实现方案', icon: <ListTodo />, onSelect: () => void runSlashCommand('/plan') },
    { slash: 'debug', label: '排障模式', description: '聚焦诊断问题和失败', icon: <Bug />, onSelect: () => void runSlashCommand('/debug') },
    { slash: 'multitask', label: '集群模式', description: '并行处理多个子任务', icon: <Boxes />, onSelect: () => void runSlashCommand('/multitask') },
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

  return (
    <div
      className={`app-shell${sidebarOpen ? '' : ' sidebar-collapsed'}`}
      style={{ '--sidebar-width': `${String(sidebarWidth)}px` } as CSSProperties}
    >
      {sidebarOpen ? (
        <Sidebar
          route={route}
          projects={projects}
          tasks={filteredTasks}
          activeProject={activeProject}
          activeSessionId={session?.id}
          search={search}
          onSearch={setSearch}
          onRoute={(next) => void changeRoute(next)}
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
            void selectProject(project).then(() => setPanel('terminal'));
          }}
          onProjectReveal={(project) => {
            void api.revealFile(project.workDir).catch((cause) => setError(messageOf(cause)));
          }}
          onProjectAddDir={(project) => {
            void api.addProjectDirectory(project.workDir, session?.workDir === project.workDir ? session.id : undefined)
              .then(async (dirs) => {
                if (activeProject?.workDir === project.workDir) {
                  setActiveProject((current) => current === undefined ? current : { ...current, additionalDirs: dirs });
                }
                await refreshProjects();
              })
              .catch((cause) => setError(messageOf(cause)));
          }}
          onProjectRemove={setRemoveProjectTarget}
          onOpenProject={() => void chooseProject()}
          onNew={() => void startNewTask()}
          onCommand={() => setCommandOpen(true)}
          onResizeStart={(clientX) => beginHorizontalResize(
            clientX,
            sidebarWidth,
            1,
            220,
            320,
            setSidebarWidth,
            'ganymede.sidebarWidth',
          )}
          userName={boot?.userName ?? 'G'}
        />
      ) : null}

      <main className="workspace">
        <TopBar
          project={activeProject}
          session={session}
          panel={panel}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
          onPanel={setPanel}
          onCommand={() => setCommandOpen(true)}
          onCancel={() => session && void api.cancelSession(session.id)}
        />

        <div className={`workspace-body${panel === 'terminal' ? ' terminal-open' : ''}`}>
          <div className="workspace-main">
          <section className={`primary-surface${emptyTask ? ' empty-surface' : ''}`}>
            {route === 'new' || route === 'chat' ? (
              session === undefined || timeline.length === 0 ? (
                <Home
                  project={activeProject}
                  chat={route === 'chat'}
                />
              ) : (
                <Timeline entries={timeline} running={session.status.running} />
              )
            ) : (
              <RoutePage
                route={route}
                activeProject={activeProject}
                session={session}
                settings={settings}
                logFile={boot?.logFile}
                modelConfiguration={boot}
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
                  if (task !== undefined) void openTask(task);
                }}
                onError={setError}
              />
            )}
            {(route === 'new' || route === 'chat') && (
              <Composer
                value={prompt}
                onChange={setPrompt}
                attachments={attachments}
                references={references}
                onPickAttachments={() => void pickAttachments()}
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
                onSubmit={() => void submitPrompt()}
                onCancel={() => session && void api.cancelSession(session.id)}
                running={session?.status.running ?? false}
                sending={sending}
                model={session?.status.model ?? draftModel ?? boot?.defaultModel}
                thinking={session?.status.thinkingEffort ?? draftThinking ?? boot?.defaultThinking}
                models={boot?.models ?? []}
                permission={session?.status.permission ?? 'manual'}
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
                onAddDir={() => {
                  if (activeProject === undefined) return;
                  void api.addProjectDirectory(activeProject.workDir, session?.id).then((dirs) => {
                    setActiveProject((project) => project === undefined ? project : { ...project, additionalDirs: dirs });
                    setSession((current) => current === undefined ? current : { ...current, additionalDirs: dirs });
                  }).catch((cause) => setError(messageOf(cause)));
                }}
                onProject={(project) => void selectProject(project)}
                onOpenProject={() => void chooseProject()}
                onConfigure={(config) => {
                  if (config.interactionMode !== undefined) {
                    setDraftInteractionMode(config.interactionMode);
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
                  });
                }}
              />
            )}
          </section>

          {panel !== 'none' && panel !== 'terminal' ? (
            <SidePanel
              panel={panel}
              project={activeProject}
              session={session}
              settings={settings}
              timeline={timeline}
              size={panel === 'browser' ? browserPanelWidth : sidePanelWidth}
              onResizeStart={(clientX) => {
                if (panel === 'browser') {
                  beginHorizontalResize(
                    clientX,
                    browserPanelWidth,
                    -1,
                    460,
                    960,
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
                  setSidePanelWidth,
                  'ganymede.sidePanelWidth',
                );
              }}
              onClose={() => setPanel('none')}
              onError={setError}
              onBrowserAnnotation={attachBrowserAnnotation}
            />
          ) : null}
          </div>
          {panel === 'terminal' ? (
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
                setTerminalHeight,
                'ganymede.terminalHeight',
              )}
              onClose={() => setPanel('none')}
              onError={setError}
              onBrowserAnnotation={attachBrowserAnnotation}
            />
          ) : null}
        </div>
      </main>

      {approval !== undefined ? (
        <ApprovalModal
          request={approval}
          onResolve={(resolution) => {
            void api.resolveApproval(resolution);
            setApproval(undefined);
          }}
        />
      ) : null}
      {question !== undefined ? (
        <QuestionModal
          request={question}
          onResolve={(resolution) => {
            void api.resolveQuestion(resolution);
            setQuestion(undefined);
          }}
        />
      ) : null}
      {commandOpen ? (
        <CommandPalette
          commands={commands}
          onClose={() => setCommandOpen(false)}
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
          body={`“${removeProjectTarget.name}”只会从侧栏隐藏，项目目录和历史任务不会被删除。`}
          confirmLabel="从侧栏移除"
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
          title="移除项目？"
        />
      ) : null}
      {error !== undefined ? <Toast message={error} onClose={() => setError(undefined)} /> : null}
    </div>
  );
}

function Sidebar(props: {
  readonly route: Route;
  readonly projects: readonly ProjectSummary[];
  readonly tasks: readonly TaskSummary[];
  readonly activeProject?: ProjectSummary;
  readonly activeSessionId?: string;
  readonly search: string;
  readonly onSearch: (value: string) => void;
  readonly onRoute: (route: Route) => void;
  readonly onProject: (project: ProjectSummary) => void;
  readonly onTask: (task: TaskSummary) => void;
  readonly onArchive: (task: TaskSummary) => void;
  readonly onPin: (task: TaskSummary) => void;
  readonly onRename: (task: TaskSummary) => void;
  readonly onFork: (task: TaskSummary) => void;
  readonly onProjectNew: (project: ProjectSummary, target: 'local' | 'worktree') => void;
  readonly onProjectPin: (project: ProjectSummary) => void;
  readonly onProjectTerminal: (project: ProjectSummary) => void;
  readonly onProjectReveal: (project: ProjectSummary) => void;
  readonly onProjectAddDir: (project: ProjectSummary) => void;
  readonly onProjectRemove: (project: ProjectSummary) => void;
  readonly onOpenProject: () => void;
  readonly onNew: () => void;
  readonly onCommand: () => void;
  readonly onResizeStart: (clientX: number) => void;
  readonly userName: string;
}): ReactNode {
  const [searchOpen, setSearchOpen] = useState(false);
  const [nativeNavOpen, setNativeNavOpen] = useState(true);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    new Set(props.activeProject === undefined ? [] : [props.activeProject.workDir]),
  );
  const [menu, setMenu] = useState<{
    readonly anchor: MenuAnchor;
    readonly project: ProjectSummary;
    readonly task?: TaskSummary;
  }>();
  useEffect(() => {
    if (props.activeProject === undefined) return;
    setExpanded((current) => new Set([...current, props.activeProject!.workDir]));
  }, [props.activeProject?.workDir]);

  const toggleProject = (workDir: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(workDir)) next.delete(workDir);
      else next.add(workDir);
      return next;
    });
  };

  const menuItems = menu === undefined
    ? []
    : menu.task === undefined
      ? projectMenuItems(menu.project, props)
      : taskMenuItems(menu.task, props);
  return (
    <aside className="sidebar">
      <div className="titlebar-drag" />
      <div className="brand-row">
        <button className="brand-lockup" onClick={props.onNew} title="伽利略 Code · GANYMEDE">
          <GanymedeMark size={24} />
          <span className="brand-wordmark">
            <strong className="brand-name"><span>伽利略</span> <span>Code</span></strong>
            <span className="brand-subtitle">GANYMEDE</span>
          </span>
        </button>
        <button aria-label="搜索与命令" className="icon-button brand-search" title="搜索与命令 ⌘K" onClick={props.onCommand}><Search size={18} /></button>
      </div>
      {searchOpen ? (
        <div className="sidebar-search">
          <Search size={14} />
          <input
            autoFocus
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="搜索任务"
          />
        </div>
      ) : null}
      <nav className="primary-nav">
        <NavButton active={props.route === 'new'} icon={<MessageSquare />} label="新建任务" shortcut="⌘ N" onClick={props.onNew} />
        <NavButton active={searchOpen} icon={<Search />} label="搜索" shortcut="⌘ K" onClick={() => setSearchOpen((value) => !value)} />
        <NavButton active={props.route === 'plugins'} icon={<WandSparkles />} label="技能与插件" onClick={() => props.onRoute('plugins')} />
      </nav>
      <button
        aria-controls="native-nav"
        aria-expanded={nativeNavOpen}
        className="native-nav-label"
        onClick={() => setNativeNavOpen((value) => !value)}
        title={nativeNavOpen ? '折叠更多功能' : '展开更多功能'}
        type="button"
      >
        {nativeNavOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>更多功能</span>
      </button>
      {nativeNavOpen ? (
        <nav className="native-nav" id="native-nav" aria-label="更多功能">
          <NavButton active={props.route === 'inbox'} icon={<Inbox />} label="收件箱" onClick={() => props.onRoute('inbox')} />
          <NavButton active={props.route === 'scheduled'} icon={<Clock3 />} label="已安排" onClick={() => props.onRoute('scheduled')} />
          <NavButton active={props.route === 'sites'} icon={<Globe2 />} label="Sites" onClick={() => props.onRoute('sites')} />
          <NavButton active={props.route === 'pulls'} icon={<GitPullRequest />} label="拉取请求" onClick={() => props.onRoute('pulls')} />
          <NavButton active={props.route === 'memory'} icon={<Brain />} label="记忆" onClick={() => props.onRoute('memory')} />
        </nav>
      ) : null}
      <div className="sidebar-section-head">
        <span><Folder size={12} /> 项目</span>
        <button title="打开项目" aria-label="打开项目" onClick={props.onOpenProject}><FolderPlus size={14} /></button>
      </div>
      <div className="project-list">
        {props.projects.map((project) => {
          const active = project.workDir === props.activeProject?.workDir;
          const projectTasks = props.tasks.filter((task) => task.workDir === project.workDir);
          const open = expanded.has(project.workDir);
          return (
            <div key={project.workDir} className="project-group">
              <div
                className={`project-row${active ? ' active' : ''}`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({ anchor: { kind: 'point', x: event.clientX, y: event.clientY }, project });
                }}
              >
                <button className="project-disclosure" aria-label={open ? '折叠项目' : '展开项目'} onClick={() => toggleProject(project.workDir)} title={open ? '折叠项目' : '展开项目'}>
                  {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <button className="project-select" onClick={() => {
                  props.onProject(project);
                  setExpanded((current) => new Set([...current, project.workDir]));
                }} title={project.workDir}>
                  <FolderGit2 size={15} />
                  <span>{project.name}</span>
                  {project.pinned ? <Pin className="project-pin" size={11} /> : null}
                  <span className="project-count">{project.sessionCount}</span>
                </button>
                <button
                  aria-label={`管理项目 ${project.name}`}
                  className="project-more"
                  onClick={(event) => setMenu({ anchor: anchorFromElement(event.currentTarget), project })}
                  title="项目菜单"
                ><MoreHorizontal size={14} /></button>
              </div>
              {open ? (
                <div className="task-list">
                  {projectTasks.map((task) => (
                    <div
                      className="task-entry"
                      key={task.id}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setMenu({ anchor: { kind: 'point', x: event.clientX, y: event.clientY }, project, task });
                      }}
                    >
                      <button
                        className={`task-row${task.id === props.activeSessionId ? ' active' : ''}`}
                        onClick={() => props.onTask(task)}
                      >
                        <span className={`task-state${task.unread ? ' unread' : ''}`} />
                        <span>
                          <strong>{task.title}</strong>
                          <small>{task.lastPrompt ?? formatRelative(task.updatedAt)}</small>
                        </span>
                      </button>
                      <button
                        aria-label={`管理任务 ${task.title}`}
                        className="task-more"
                        onClick={(event) => setMenu({ anchor: anchorFromElement(event.currentTarget), project, task })}
                        title="任务菜单"
                      ><MoreHorizontal size={13} /></button>
                    </div>
                  ))}
                  {projectTasks.length === 0 ? <small className="empty-task-list">暂无任务</small> : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {props.projects.length === 0 ? (
          <button className="empty-project" onClick={props.onOpenProject}>
            <Folder size={20} />
            <span>打开第一个项目</span>
          </button>
        ) : null}
      </div>
      <div className="sidebar-footer">
        <button className="account-button">
          <span className="avatar">{props.userName.slice(0, 1).toUpperCase()}</span>
          <span><strong>{props.userName}</strong><small>本地工作区</small></span>
        </button>
        <button aria-label="设置" className="icon-button" onClick={() => props.onRoute('settings')} title="设置">
          <Settings size={16} />
        </button>
      </div>
      {menu !== undefined ? (
        <AppMenuPopover
          anchor={menu.anchor}
          ariaLabel={menu.task === undefined ? '项目菜单' : '任务菜单'}
          items={menuItems}
          onClose={() => setMenu(undefined)}
          placement="bottom-start"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="sidebar-resize-handle"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          props.onResizeStart(event.clientX);
        }}
      />
    </aside>
  );
}

function projectMenuItems(
  project: ProjectSummary,
  props: Parameters<typeof Sidebar>[0],
): readonly AppMenuItem[] {
  return [
    { id: 'new', label: '新建任务', icon: <Plus />, onSelect: () => props.onProjectNew(project, 'local') },
    { id: 'worktree', label: '新建 Worktree 任务', icon: <GitBranch />, onSelect: () => props.onProjectNew(project, 'worktree') },
    { id: 'project-separator-1', separator: true },
    { id: 'pin', label: project.pinned ? '取消置顶' : '置顶项目', icon: <Pin />, onSelect: () => props.onProjectPin(project) },
    { id: 'terminal', label: '在终端中打开', icon: <TerminalSquare />, onSelect: () => props.onProjectTerminal(project) },
    { id: 'reveal', label: '在 Finder 中显示', icon: <FolderOpen />, onSelect: () => props.onProjectReveal(project) },
    { id: 'add-dir', label: '添加工作目录', icon: <FolderPlus />, onSelect: () => props.onProjectAddDir(project) },
    { id: 'project-separator-2', separator: true },
    { id: 'remove', label: '从侧栏移除…', icon: <Trash2 />, danger: true, onSelect: () => props.onProjectRemove(project) },
  ];
}

function taskMenuItems(
  task: TaskSummary,
  props: Parameters<typeof Sidebar>[0],
): readonly AppMenuItem[] {
  return [
    { id: 'open', label: '打开任务', icon: <MessageSquare />, onSelect: () => props.onTask(task) },
    { id: 'rename', label: '重命名…', icon: <FileText />, onSelect: () => props.onRename(task) },
    { id: 'fork', label: '创建副本', icon: <Copy />, onSelect: () => props.onFork(task) },
    { id: 'task-separator-1', separator: true },
    { id: 'pin', label: task.pinned ? '取消置顶' : '置顶任务', icon: <Pin />, onSelect: () => props.onPin(task) },
    { id: 'archive', label: '归档任务', icon: <Archive />, onSelect: () => props.onArchive(task) },
  ];
}

function NavButton(props: {
  readonly active: boolean;
  readonly icon: ReactNode;
  readonly label: string;
  readonly shortcut?: string;
  readonly onClick: () => void;
}): ReactNode {
  return (
    <button className={`nav-button${props.active ? ' active' : ''}`} onClick={props.onClick}>
      <span>{props.icon}</span>
      {props.label}
      {props.shortcut !== undefined ? <kbd>{props.shortcut}</kbd> : null}
    </button>
  );
}

function TopBar(props: {
  readonly project?: ProjectSummary;
  readonly session?: SessionSnapshot;
  readonly panel: Panel;
  readonly sidebarOpen: boolean;
  readonly onToggleSidebar: () => void;
  readonly onPanel: (panel: Panel) => void;
  readonly onCommand: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button aria-label="切换侧栏" className="icon-button" onClick={props.onToggleSidebar} title="切换侧栏 ⌘B">
          <PanelRight size={16} className={props.sidebarOpen ? '' : 'flip'} />
        </button>
        {props.session !== undefined ? (
          <div className="breadcrumbs">
            <span>{props.session.title}</span>
            {props.project?.branch !== undefined ? (
            <>
              <span className="slash">/</span>
              <GitBranch size={13} />
              <span>{props.project.branch}</span>
            </>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="topbar-center">
        {props.session?.status.running === true ? (
          <span className="run-state"><span className="pulse" /> 正在工作</span>
        ) : props.session !== undefined ? (
          <span className="run-state quiet"><Check size={13} /> 已就绪</span>
        ) : null}
      </div>
      <div className="topbar-actions">
        {props.session?.status.running === true ? (
          <button aria-label="停止任务" className="icon-button danger" onClick={props.onCancel} title="停止任务">
            <CircleStop size={16} />
          </button>
        ) : null}
        <button aria-label="命令面板" className="icon-button" onClick={props.onCommand} title="命令面板 ⌘K">
          <Command size={16} />
        </button>
        <PanelButton panel="files" current={props.panel} icon={<FileText />} onClick={props.onPanel} />
        <PanelButton panel="review" current={props.panel} icon={<FileDiff />} onClick={props.onPanel} />
        <PanelButton panel="terminal" current={props.panel} icon={<TerminalSquare />} onClick={props.onPanel} />
        <PanelButton panel="browser" current={props.panel} icon={<Globe2 />} onClick={props.onPanel} />
        <PanelButton panel="agents" current={props.panel} icon={<Boxes />} onClick={props.onPanel} />
        <PanelButton panel="summary" current={props.panel} icon={<Sparkles />} onClick={props.onPanel} />
      </div>
    </header>
  );
}

function PanelButton(props: {
  readonly panel: Exclude<Panel, 'none'>;
  readonly current: Panel;
  readonly icon: ReactNode;
  readonly onClick: (panel: Panel) => void;
}): ReactNode {
  return (
    <button
      className={`icon-button${props.current === props.panel ? ' active' : ''}`}
      onClick={() => props.onClick(props.current === props.panel ? 'none' : props.panel)}
      title={panelLabel(props.panel)}
      aria-label={panelLabel(props.panel)}
    >
      {props.icon}
    </button>
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

function Timeline(props: {
  readonly entries: readonly TimelineEntry[];
  readonly running: boolean;
}): ReactNode {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [props.entries]);
  return (
    <div className="timeline">
      <div className="timeline-inner">
        {props.entries.map((entry) => <TimelineBlock key={entry.id} entry={entry} />)}
        {props.running ? (
          <div className="working-row">
            <span className="orb-loader"><i /><i /><i /></span>
            <span>Ganymede 正在推进任务</span>
          </div>
        ) : null}
        <div ref={bottom} />
      </div>
    </div>
  );
}

function TimelineBlock({ entry }: { readonly entry: TimelineEntry }): ReactNode {
  if (entry.kind === 'user') return <div className="message user-message">{entry.content}</div>;
  if (entry.kind === 'assistant') {
    return (
      <article className="message assistant-message">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown>
        {entry.streaming ? <span className="cursor" /> : null}
      </article>
    );
  }
  if (entry.kind === 'thinking') {
    return (
      <details className="thinking-block">
        <summary><Brain size={14} /> 思考过程</summary>
        <div>{entry.content}</div>
      </details>
    );
  }
  if (entry.kind === 'tool') {
    return (
      <details className={`tool-block${entry.error ? ' error' : ''}`} open={entry.streaming}>
        <summary>
          {entry.streaming ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}
          <strong>{entry.title ?? '工具'}</strong>
          <span>{entry.streaming ? '运行中' : entry.error ? '失败' : '完成'}</span>
          <ChevronDown size={14} />
        </summary>
        {entry.content.length > 0 ? <pre>{entry.content}</pre> : null}
      </details>
    );
  }
  return (
    <div className={`status-block ${entry.kind}`}>
      {entry.kind === 'error' ? <X size={14} /> : entry.kind === 'subagent' ? <Bot size={14} /> : <Sparkles size={14} />}
      <span>{entry.title ?? entry.content}</span>
      {entry.title !== undefined && entry.content.length > 0 ? <small>{entry.content}</small> : null}
    </div>
  );
}

function Composer(props: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly attachments: readonly PromptAttachment[];
  readonly references: readonly PromptReference[];
  readonly onPickAttachments: () => void;
  readonly onRemoveAttachment: (path: string) => void;
  readonly onAddReference: (reference: PromptReference) => void;
  readonly onRemoveReference: (reference: PromptReference) => void;
  readonly onSubmit: () => void;
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
  readonly onAddDir: () => void;
  readonly onProject: (project: ProjectSummary) => void;
  readonly onOpenProject: () => void;
  readonly onConfigure: (config: SessionConfigurationInput) => void;
}): ReactNode {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState<{
    readonly kind: 'plus' | 'project' | 'permission' | 'target' | 'model';
    readonly anchor: MenuAnchor;
  }>();
  const [trigger, setTrigger] = useState<TriggerContext>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [paths, setPaths] = useState<readonly PathSuggestion[]>([]);
  const [skills, setSkills] = useState<readonly SkillView[]>([]);
  useEffect(() => {
    if (textarea.current === null) return;
    textarea.current.style.height = 'auto';
    textarea.current.style.height = `${String(Math.min(textarea.current.scrollHeight, 180))}px`;
  }, [props.value]);

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

  const suggestions: readonly ComposerSuggestion[] = trigger === undefined
    ? []
    : trigger.trigger === '@'
      ? paths.map((item) => ({
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
        }))
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
  const modeChildren = interactionModeMenuItems(props.interactionMode, props.onConfigure);
  const plusItems: readonly AppMenuItem[] = [
    { id: 'attachment', label: '添加附件', icon: <Paperclip />, onSelect: props.onPickAttachments },
    { id: 'mention', label: '插入 @ 提及', icon: <AtSign />, onSelect: () => insertTrigger('@') },
    { id: 'command', label: '插入 / 命令', icon: <TerminalSquare />, onSelect: () => insertTrigger('/') },
    { id: 'skill', label: '插入 $ 技能', icon: <WandSparkles />, onSelect: () => insertTrigger('$') },
    { id: 'session', label: '插入 # 会话', icon: <Hash />, onSelect: () => insertTrigger('#') },
    { id: 'composer-separator', separator: true },
    { id: 'mode', label: '工作模式', description: INTERACTION_MODE_LABELS[props.interactionMode], icon: <SlidersHorizontal />, children: modeChildren },
  ];
  const projectItems: readonly AppMenuItem[] = [
    ...props.projects.map((project) => ({
      id: project.workDir,
      label: project.name,
      description: project.branch,
      icon: <FolderGit2 />,
      checked: project.workDir === props.project?.workDir,
      onSelect: () => props.onProject(project),
    })),
    { id: 'project-separator', separator: true },
    { id: 'open-project', label: '打开其他项目…', icon: <FolderOpen />, onSelect: props.onOpenProject },
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
    : menu?.kind === 'project'
      ? projectItems
      : menu?.kind === 'permission'
        ? permissionItems
        : menu?.kind === 'target'
          ? targetItems
          : modelItems;
  return (
    <div className="composer-dock">
      <div className={`composer${props.running ? ' running' : ''} mode-${props.interactionMode}`}>
        <div className="composer-context">
          <button className="composer-project" onClick={(event) => setMenu({ kind: 'project', anchor: anchorFromElement(event.currentTarget) })}>
            <Folder size={14} /> {props.project?.name ?? '选择项目'} <ChevronDown size={12} />
          </button>
          {props.session?.additionalDirs.map((dir) => <span className="extra-context" key={dir}><Plus size={11} /> {dir.split('/').at(-1)}</span>)}
          <button className="add-context" onClick={props.onAddDir}><Plus size={11} /> 添加目录</button>
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
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              props.onSubmit();
            }
          }}
          placeholder={props.running ? '输入后续指示以调整当前任务…' : '向 Ganymede 提问，@ 提及文件，/ 使用命令，$ 使用技能，# 关联会话'}
          rows={1}
        />
        {trigger !== undefined ? (
          <ComposerSuggestions
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
              aria-label="设备端听写"
              className="circle-action secondary-action"
              title="设备端听写"
              onClick={() => startDictation((text) => props.onChange(`${props.value}${props.value ? ' ' : ''}${text}`))}
            >
              <Mic size={15} />
            </button>
            <button className="composer-menu-button" onClick={(event) => setMenu({ kind: 'permission', anchor: anchorFromElement(event.currentTarget) })}>
              {permissionIcon(props.permission)} {permissionLabel(props.permission)} <ChevronDown size={11} />
            </button>
            <span className="composer-mode-status">{interactionModeIcon(props.interactionMode)} {INTERACTION_MODE_LABELS[props.interactionMode]}</span>
            <button className="composer-menu-button" onClick={(event) => setMenu({ kind: 'target', anchor: anchorFromElement(event.currentTarget) })}>
              {targetIcon(props.target)} {targetLabel(props.target, props.sshProfileId, props.sshProfiles)} <ChevronDown size={11} />
            </button>
          </div>
          <div>
            <button className="model-label" onClick={(event) => setMenu({ kind: 'model', anchor: anchorFromElement(event.currentTarget) })}>
              <Sparkles size={13} /> {modelLabel(props.model, props.thinking, props.models)} <ChevronDown size={11} />
            </button>
            {props.running ? (
              <button aria-label="停止任务" className="send-button stop" onClick={props.onCancel} title="停止任务"><CircleStop size={16} /></button>
            ) : (
              <button
                className="send-button"
                aria-label="发送"
                title="发送"
                disabled={props.sending || (props.value.trim().length === 0 && props.attachments.length === 0 && props.references.length === 0)}
                onClick={props.onSubmit}
              >
                {props.sending ? <LoaderCircle className="spin" size={16} /> : <ArrowUp size={17} />}
              </button>
            )}
          </div>
        </div>
      </div>
      <small className="composer-hint"><TerminalSquare size={11} /> {props.target === 'worktree' ? 'Worktree' : props.target === 'ssh' ? '远程 SSH' : '本地工作区'} · Enter 发送</small>
      {menu !== undefined ? (
        <AppMenuPopover
          anchor={menu.anchor}
          ariaLabel="输入框菜单"
          items={activeMenuItems}
          onClose={() => setMenu(undefined)}
          placement={menu.kind === 'plus' ? 'top-start' : 'bottom-start'}
          searchPlaceholder={
            menu.kind === 'model'
              ? '搜索模型或服务商'
              : menu.kind === 'project'
                ? '搜索最近项目…'
                : undefined
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
  readonly onSelect: (index: number) => void;
}): ReactNode {
  return (
    <div className="composer-suggestions" role="listbox" aria-label={`${props.trigger} 联想`}>
      <header><span>{triggerTitle(props.trigger)}</span><kbd>↑↓ 选择 · ↵ 确认</kbd></header>
      <div>
        {props.items.slice(0, 12).map((item, index) => (
          <button
            aria-selected={index === props.selectedIndex}
            className={index === props.selectedIndex ? 'active' : undefined}
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
        {props.items.length === 0 ? <p>没有匹配项</p> : null}
      </div>
    </div>
  );
}

function interactionModeMenuItems(
  current: InteractionMode,
  onConfigure: (config: SessionConfigurationInput) => void,
): readonly AppMenuItem[] {
  const modes: readonly InteractionMode[] = ['agent', 'ask', 'plan', 'debug', 'multitask'];
  return modes.map((mode) => ({
    id: mode,
    label: INTERACTION_MODE_LABELS[mode],
    description: interactionModeDescription(mode),
    icon: interactionModeIcon(mode),
    checked: current === mode,
    onSelect: () => onConfigure({ interactionMode: mode }),
  }));
}

function permissionMenuItems(
  current: 'manual' | 'auto' | 'yolo',
  onConfigure: (config: SessionConfigurationInput) => void,
): readonly AppMenuItem[] {
  return (['manual', 'auto', 'yolo'] as const).map((permission) => ({
    id: permission,
    label: permissionLabel(permission),
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

function modelMenuItems(
  current: string | undefined,
  currentThinking: string | undefined,
  models: readonly ModelOption[],
  onConfigure: (config: SessionConfigurationInput) => void,
): readonly AppMenuItem[] {
  if (models.length === 0) return [{ id: 'missing-model', label: '未配置可用模型', icon: <ShieldAlert />, disabled: true }];
  return models.map((model) => ({
    id: model.id,
    label: model.label,
    description: `${model.provider} · 思考默认 ${thinkingLabel(model.defaultThinking)}`,
    icon: <Sparkles />,
    checked: model.id === current,
    children: model.thinkingEfforts.length > 1
      ? model.thinkingEfforts.map((thinking) => ({
          id: `${model.id}:${thinking}`,
          label: `思考 ${thinkingLabel(thinking)}`,
          description: thinking === model.defaultThinking ? '模型默认' : undefined,
          checked: model.id === current && thinking === currentThinking,
          icon: <Brain size={13} />,
          onSelect: () => onConfigure({ model: model.id, thinking }),
        }))
      : undefined,
    onSelect: model.thinkingEfforts.length === 1
      ? () => onConfigure({ model: model.id, thinking: model.thinkingEfforts[0] })
      : undefined,
  }));
}

function interactionModeIcon(mode: InteractionMode): ReactNode {
  if (mode === 'agent') return <Bot size={13} />;
  if (mode === 'ask') return <MessageCircle size={13} />;
  if (mode === 'plan') return <ListTodo size={13} />;
  if (mode === 'debug') return <Bug size={13} />;
  return <Boxes size={13} />;
}

function interactionModeDescription(mode: InteractionMode): string {
  if (mode === 'agent') return '执行完整的软件开发任务';
  if (mode === 'ask') return '围绕当前项目讨论与问答';
  if (mode === 'plan') return '先分析并制定实现方案';
  if (mode === 'debug') return '聚焦诊断问题和失败';
  return '并行处理多个子任务';
}

function permissionIcon(permission: 'manual' | 'auto' | 'yolo'): ReactNode {
  if (permission === 'manual') return <ShieldQuestion size={13} />;
  if (permission === 'auto') return <ShieldCheck size={13} />;
  return <ShieldAlert size={13} />;
}

function permissionLabel(permission: 'manual' | 'auto' | 'yolo'): string {
  if (permission === 'manual') return '请求批准';
  if (permission === 'auto') return '自动安全操作';
  return '完全访问';
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

function modelLabel(
  model: string | undefined,
  thinking: string | undefined,
  models: readonly ModelOption[],
): string {
  if (model === undefined) return '未配置模型';
  const option = models.find((candidate) => candidate.id === model);
  const label = option?.label ?? model;
  const effort = thinking ?? option?.defaultThinking;
  return effort === undefined ? label : `${label} · ${thinkingLabel(effort)}`;
}

function thinkingLabel(effort: string): string {
  if (effort === 'off') return '关闭';
  if (effort === 'on') return '开启';
  return effort.charAt(0).toUpperCase() + effort.slice(1);
}

function triggerTitle(trigger: ComposerTrigger): string {
  if (trigger === '@') return '文件与文件夹';
  if (trigger === '/') return '命令';
  if (trigger === '$') return '技能';
  return '关联会话';
}

function referenceKey(reference: PromptReference): string {
  if (reference.kind === 'path') return `path:${reference.root}:${reference.path}`;
  if (reference.kind === 'skill') return `skill:${reference.name}`;
  return `session:${reference.sessionId}`;
}

function referenceLabel(reference: PromptReference): string {
  if (reference.kind === 'path') return reference.path;
  if (reference.kind === 'skill') return `$${reference.name}`;
  return reference.title;
}

function referenceIcon(reference: PromptReference): ReactNode {
  if (reference.kind === 'path') {
    return reference.pathKind === 'directory' ? <Folder size={12} /> : <AtSign size={12} />;
  }
  if (reference.kind === 'skill') return <WandSparkles size={12} />;
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
  readonly panel: Exclude<Panel, 'none'>;
  readonly project?: ProjectSummary;
  readonly session?: SessionSnapshot;
  readonly settings?: AppSettings;
  readonly timeline: readonly TimelineEntry[];
  readonly size: number;
  readonly onResizeStart: (coordinate: number) => void;
  readonly onClose: () => void;
  readonly onError: (message: string) => void;
  readonly onBrowserAnnotation: (annotation: BrowserAnnotation) => void;
}): ReactNode {
  return (
    <aside
      className={`side-panel ${props.panel}`}
      style={props.panel === 'terminal' ? { height: props.size } : { width: props.size }}
    >
      <div
        aria-hidden="true"
        className={`panel-resize-handle ${props.panel === 'terminal' ? 'vertical' : 'horizontal'}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          props.onResizeStart(props.panel === 'terminal' ? event.clientY : event.clientX);
        }}
      />
      {props.panel === 'terminal' || props.panel === 'browser' ? null : (
        <div className="panel-head">
          <strong>{panelLabel(props.panel)}</strong>
          <button aria-label={`关闭${panelLabel(props.panel)}面板`} className="icon-button" onClick={props.onClose} title="关闭面板"><X size={15} /></button>
        </div>
      )}
      {props.panel === 'summary' ? <SummaryPanel session={props.session} timeline={props.timeline} /> : null}
      {props.panel === 'review' ? <ReviewPanel project={props.project} onError={props.onError} /> : null}
      {props.panel === 'files' ? <FilesPanel project={props.project} onError={props.onError} /> : null}
      {props.panel === 'agents' ? <AgentsPanel session={props.session} onError={props.onError} /> : null}
      {props.panel === 'terminal' ? (
        <TerminalPanel
          project={props.project}
          session={props.session}
          settings={props.settings}
          onClose={props.onClose}
          onError={props.onError}
        />
      ) : null}
      {props.panel === 'browser' ? (
        <BrowserPanel
          session={props.session}
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
}): ReactNode {
  const tools = props.timeline.filter((entry) => entry.kind === 'tool');
  const errors = props.timeline.filter((entry) => entry.kind === 'error');
  const assistants = props.timeline.filter((entry) => entry.kind === 'assistant');
  const last = assistants.at(-1);
  return (
    <div className="panel-content">
      <div className="metric-grid">
        <Metric label="工具调用" value={tools.length} />
        <Metric label="错误" value={errors.length} />
        <Metric label="上下文" value={`${Math.round(((props.session?.status.contextTokens ?? 0) / Math.max(1, props.session?.status.maxContextTokens ?? 1)) * 100)}%`} />
        <Metric label="模式" value={INTERACTION_MODE_LABELS[props.session?.status.interactionMode ?? 'agent']} />
      </div>
      <section className="summary-section">
        <h3>当前任务</h3>
        <p>{props.session?.title ?? '尚未开始任务'}</p>
      </section>
      <section className="summary-section">
        <h3>最新结果</h3>
        {last !== undefined ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{last.content.slice(0, 2_000)}</ReactMarkdown> : <p className="muted">暂无结果</p>}
      </section>
    </div>
  );
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
        <EmptyPanel icon={<Bot />} text="当前还没有后台 Agent 或任务" />
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

function ReviewPanel(props: {
  readonly project?: ProjectSummary;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [status, setStatus] = useState<GitStatus>();
  const [diff, setDiff] = useState('');
  const [staged, setStaged] = useState(false);
  const [commit, setCommit] = useState('');
  const refresh = useCallback(async () => {
    if (props.project === undefined) return;
    try {
      const [nextStatus, nextDiff] = await Promise.all([
        api.gitStatus(props.project.workDir),
        api.gitDiff(props.project.workDir, staged),
      ]);
      setStatus(nextStatus);
      setDiff(nextDiff.text);
    } catch (cause) {
      props.onError(messageOf(cause));
    }
  }, [props.project, props.onError, staged]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (props.project === undefined) return <EmptyPanel icon={<FileDiff />} text="选择 Git 项目后查看改动" />;
  return (
    <div className="panel-content review-panel">
      <div className="review-summary">
        <span><GitBranch size={13} /> {status?.branch ?? '—'}</span>
        <span>{status?.files.length ?? 0} 个文件</span>
        <button aria-label="刷新改动" onClick={() => void refresh()} title="刷新改动"><RefreshCw size={13} /></button>
      </div>
      <div className="segmented">
        <button className={!staged ? 'active' : ''} onClick={() => setStaged(false)}>未暂存</button>
        <button className={staged ? 'active' : ''} onClick={() => setStaged(true)}>已暂存</button>
      </div>
      <div className="changed-files">
        {status?.files.map((file) => (
          <div key={file.path}>
            <FileCode2 size={13} />
            <span>{file.path}</span>
            <code>{file.index}{file.worktree}</code>
            <button onClick={() => void (staged ? api.gitUnstage(props.project!.workDir, [file.path]) : api.gitStage(props.project!.workDir, [file.path])).then(refresh)}>{staged ? '取消' : '暂存'}</button>
          </div>
        ))}
      </div>
      <pre className="diff-view">{diff || '没有可显示的改动。'}</pre>
      <div className="commit-box">
        <input value={commit} onChange={(event) => setCommit(event.target.value)} placeholder="提交说明" />
        <button disabled={commit.trim().length === 0} onClick={() => void api.gitCommit(props.project!.workDir, commit).then(() => { setCommit(''); void refresh(); }).catch((cause) => props.onError(messageOf(cause)))}><GitCommit size={14} /> 提交</button>
        <button onClick={() => void api.gitPush(props.project!.workDir).catch((cause) => props.onError(messageOf(cause)))}>推送</button>
      </div>
    </div>
  );
}

function FilesPanel(props: {
  readonly project?: ProjectSummary;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [entries, setEntries] = useState<readonly FileEntry[]>([]);
  const [selected, setSelected] = useState<FileContent>();
  const [editing, setEditing] = useState('');
  useEffect(() => {
    if (props.project === undefined) return;
    void api.listFiles(props.project.workDir).then(setEntries).catch((cause) => props.onError(messageOf(cause)));
  }, [props.project, props.onError]);
  async function open(path: string): Promise<void> {
    if (props.project === undefined) return;
    try {
      const content = await api.readFile(props.project.workDir, path);
      setSelected(content);
      setEditing(content.content ?? '');
    } catch (cause) {
      props.onError(messageOf(cause));
    }
  }
  if (props.project === undefined) return <EmptyPanel icon={<FileText />} text="选择项目后浏览文件" />;
  return (
    <div className="files-layout">
      <div className="file-tree"><FileTree entries={entries} onOpen={(path) => void open(path)} /></div>
      {selected !== undefined ? (
        <div className="file-preview">
          <div className="file-preview-head">
            <strong>{selected.name}</strong>
            <button aria-label="在外部应用打开" onClick={() => void api.openFileExternal(selected.path)} title="在外部应用打开"><Maximize2 size={13} /></button>
          </div>
          {selected.kind === 'text' ? (
            <>
              <textarea value={editing} onChange={(event) => setEditing(event.target.value)} spellCheck={false} />
              <button className="save-file" onClick={() => void api.writeFile(props.project!.workDir, selected.path, editing)}>保存</button>
            </>
          ) : selected.dataUrl !== undefined ? (
            selected.kind === 'image' ? <img src={selected.dataUrl} /> : <embed src={selected.dataUrl} />
          ) : <div className="binary-file">无法在应用内预览该文件。</div>}
        </div>
      ) : null}
    </div>
  );
}

function FileTree(props: {
  readonly entries: readonly FileEntry[];
  readonly onOpen: (path: string) => void;
}): ReactNode {
  return (
    <>
      {props.entries.map((entry) => (
        <FileNode key={entry.path} entry={entry} onOpen={props.onOpen} />
      ))}
    </>
  );
}

function FileNode(props: {
  readonly entry: FileEntry;
  readonly onOpen: (path: string) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  if (props.entry.kind === 'directory') {
    return (
      <div className="file-node directory">
        <button onClick={() => setOpen((value) => !value)}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}<Folder size={13} />{props.entry.name}
        </button>
        {open && props.entry.children !== undefined ? <div className="file-children"><FileTree entries={props.entry.children} onOpen={props.onOpen} /></div> : null}
      </div>
    );
  }
  return <button className="file-node file" onClick={() => props.onOpen(props.entry.path)}><FileCode2 size={13} />{props.entry.name}</button>;
}

function readMonoFontCssVar(): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue('--font-mono');
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
    // Capture session id once when the project opens; do not recreate on session changes.
    const sessionId = props.session?.id;
    void api.createTerminal(props.project.workDir, sessionId)
      .then((tab) => {
        if (!alive) {
          void api.closeTerminal(tab.id);
          return;
        }
        // Preserve any early PTY output already buffered under this id.
        if (!buffers.current.has(tab.id)) buffers.current.set(tab.id, '');
        setTabs([tab]);
        activeIdRef.current = tab.id;
        setActiveId(tab.id);
        showTabBuffer(tab.id);
      })
      .catch((cause: unknown) => {
        if (alive) props.onError(messageOf(cause));
      });
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
    if (terminal.current === undefined) return;
    terminal.current.options.fontFamily = fontFamily;
    terminal.current.options.fontSize = fontSize;
    terminal.current.options.theme = readTerminalThemeFromDocument();
    terminal.current.refresh(0, Math.max(0, terminal.current.rows - 1));
    scheduleFit();
  }, [fontFamily, fontSize, props.settings?.theme, props.settings?.accent, scheduleFit]);

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
  return (
    <div className="terminal-panel">
      <div className="terminal-tabs">
        {tabs.map((tab, index) => (
          <button
            className={tab.id === activeId ? 'active' : ''}
            key={tab.id}
            onClick={() => {
              activeIdRef.current = tab.id;
              setActiveId(tab.id);
              showTabBuffer(tab.id);
            }}
          >
            <TerminalSquare size={12} /> {tab.title} {index + 1}
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
        <button aria-label="新建终端标签" onClick={() => void createTab()} title="新建终端标签"><Plus size={12} /></button>
        <div className="terminal-tab-actions">
          <button aria-label="复制选中内容" onClick={copySelection} title="复制选中内容"><Copy size={12} /></button>
          <button aria-label="清屏" onClick={clearActive} title="清屏"><Eraser size={12} /></button>
          <button aria-label="关闭终端面板" className="terminal-panel-close" title="关闭终端面板" onClick={props.onClose}><X size={12} /></button>
        </div>
      </div>
      <div className="terminal-host" ref={host} />
    </div>
  );
}

interface BrowserBookmarkItem {
  readonly id: string;
  readonly title: string;
  readonly url: string;
}

function BrowserPanel(props: {
  readonly session?: SessionSnapshot;
  readonly onAnnotation: (annotation: BrowserAnnotation) => void;
  readonly onClose: () => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [tabs, setTabs] = useState<readonly BrowserTab[]>([]);
  const tabsRef = useRef<readonly BrowserTab[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const activeIdRef = useRef<string | undefined>(undefined);
  const [url, setUrl] = useState('about:blank');
  const [annotating, setAnnotating] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [bookmarksOpen, setBookmarksOpen] = useState(true);
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
    let alive = true;
    setTabs([]);
    setActiveId(undefined);
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
    void api.createBrowser(props.session?.id, 'about:blank')
      .then((tab) => {
        if (!alive) {
          void api.closeBrowser(tab.id);
          return;
        }
        setTabs([tab]);
        setActiveId(tab.id);
        setUrl(tab.url);
      })
      .catch((cause: unknown) => {
        if (alive) props.onError(messageOf(cause));
      });
    return () => {
      alive = false;
      unsubscribe();
      for (const tab of tabsRef.current) void api.closeBrowser(tab.id);
      tabsRef.current = [];
    };
  }, [props.session?.id, props.onError]);

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

  const closeTab = (id: string): void => {
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
  };

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

  return (
    <div className="browser-panel">
      <div className="browser-tabs">
        {tabs.map((tab, index) => (
          <div className={`browser-tab${tab.id === activeId ? ' active' : ''}`} key={tab.id}>
            <button className="browser-tab-select" onClick={() => {
              setActiveId(tab.id);
              setUrl(tab.url);
            }} title={tab.title || tab.url}>
              <Globe2 size={11} /> <span>{tab.title || `Tab ${String(index + 1)}`}</span>
            </button>
            <button aria-label={`关闭标签 ${tab.title || String(index + 1)}`} className="browser-tab-close" onClick={() => closeTab(tab.id)} title="关闭标签"><X size={10} /></button>
          </div>
        ))}
        <button aria-label="新建浏览器标签" onClick={() => void createTab()} title="新建浏览器标签"><Plus size={12} /></button>
        <button aria-label="关闭浏览器面板" className="browser-panel-close" onClick={props.onClose} title="关闭浏览器面板"><X size={12} /></button>
      </div>
      <div className="browser-toolbar">
        <div className="browser-location-row">
          <div className="browser-nav-actions">
            <button aria-label="后退" disabled={!activeTab?.canGoBack} onClick={() => activeTab && void api.browserAction(activeTab.id, 'back')} title="后退"><ArrowLeft size={14} /></button>
            <button aria-label="前进" disabled={!activeTab?.canGoForward} onClick={() => activeTab && void api.browserAction(activeTab.id, 'forward')} title="前进"><ArrowRight size={14} /></button>
            <button aria-label="重新载入" disabled={activeTab === undefined} onClick={() => activeTab && void api.browserAction(activeTab.id, activeTab.loading ? 'stop' : 'reload')} title={activeTab?.loading ? '停止载入' : '重新载入'}><RefreshCw className={activeTab?.loading ? 'spin' : ''} size={14} /></button>
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (activeTab) void api.browserNavigate(activeTab.id, url).catch((cause: unknown) => props.onError(messageOf(cause)));
          }}>
            <Globe2 size={13} />
            <input aria-label="浏览器地址" value={url} onChange={(event) => setUrl(event.target.value)} />
          </form>
          <button aria-label={bookmarked ? '移除当前书签' : '收藏当前页面'} className={bookmarked ? 'active' : ''} disabled={activeTab === undefined || activeTab.url === 'about:blank'} onClick={bookmarkActive} title={bookmarked ? '移除当前书签' : '收藏当前页面'}><Star fill={bookmarked ? 'currentColor' : 'none'} size={14} /></button>
          <button aria-label="显示或隐藏书签栏" className={bookmarksOpen ? 'active' : ''} onClick={() => setBookmarksOpen((value) => !value)} title="显示或隐藏书签栏"><Bookmark size={14} /></button>
        </div>
        <div className="browser-action-row">
          <div className="browser-zoom-actions">
            <button aria-label="缩小页面" disabled={activeTab === undefined} onClick={() => activeTab && void api.browserAction(activeTab.id, 'zoom-out')} title="缩小页面"><ZoomOut size={14} /></button>
            <button aria-label="重置为百分之百" className="browser-zoom-label" disabled={activeTab === undefined} onClick={() => activeTab && void api.browserAction(activeTab.id, 'zoom-reset')} title="重置为 100%">{zoomLabel}</button>
            <button aria-label="放大页面" disabled={activeTab === undefined} onClick={() => activeTab && void api.browserAction(activeTab.id, 'zoom-in')} title="放大页面"><ZoomIn size={14} /></button>
            <button aria-label="适合面板宽度" className={activeTab?.autoFit ? 'active' : ''} disabled={activeTab === undefined} onClick={() => activeTab && void api.browserAction(activeTab.id, 'fit')} title="适合面板宽度"><Maximize2 size={13} /></button>
          </div>
          <span aria-live="polite" className="browser-feedback">{feedback}</span>
          <div className="browser-page-actions">
            <button aria-label="标注页面元素" className={annotating ? 'active' : ''} disabled={activeTab === undefined || annotating} title="标注页面元素并附到对话框" onClick={() => void annotate()}>{annotating ? <LoaderCircle className="spin" size={14} /> : <MessageSquare size={14} />}</button>
            <button aria-label="保存页面截图" disabled={activeTab === undefined} onClick={() => activeTab && void api.browserScreenshot(activeTab.id).then((data) => downloadDataUrl(data, 'ganymede-browser.png')).catch((cause: unknown) => props.onError(messageOf(cause)))} title="保存页面截图"><Sparkles size={14} /></button>
            <button aria-label="开发人员工具" className={activeTab?.devToolsOpen ? 'active' : ''} disabled={activeTab === undefined} onClick={() => activeTab && void api.browserAction(activeTab.id, 'devtools')} title="打开开发人员工具"><Code2 size={14} /></button>
          </div>
        </div>
      </div>
      {bookmarksOpen ? (
        <div className="browser-bookmark-bar">
          <Bookmark size={12} />
          {bookmarks.length === 0 ? <span>点击星标收藏当前页面</span> : bookmarks.map((bookmark) => (
            <div className="browser-bookmark" key={bookmark.id}>
              <button className="browser-bookmark-link" onClick={() => activeTab && void api.browserNavigate(activeTab.id, bookmark.url)} title={bookmark.url}><Globe2 size={11} /><span>{bookmark.title}</span></button>
              <button aria-label={`删除书签 ${bookmark.title}`} className="browser-bookmark-remove" onClick={() => saveBookmarks(bookmarks.filter((item) => item.id !== bookmark.id))} title="删除书签"><X size={9} /></button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="browser-viewport" ref={viewport}>
        {activeTab?.loading ? <LoaderCircle className="spin browser-loading" size={18} /> : null}
      </div>
    </div>
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
  readonly onSettings: (settings: AppSettings) => void;
  readonly onModelConfiguration: (configuration: ModelConfiguration) => void;
  readonly onOpenTask: (id: string) => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  switch (props.route) {
    case 'inbox':
      return <InboxPage onOpenTask={props.onOpenTask} onError={props.onError} />;
    case 'scheduled':
      return <ScheduledPage project={props.activeProject} onError={props.onError} />;
    case 'plugins':
      return <PluginsPage session={props.session} onError={props.onError} />;
    case 'sites':
      return <SitesPage onError={props.onError} />;
    case 'pulls':
      return <PullsPage project={props.activeProject} onError={props.onError} />;
    case 'memory':
      return <MemoryPage project={props.activeProject} onError={props.onError} />;
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

function PageFrame(props: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly subtitle: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="route-page">
      <header className="page-heading">
        <span>{props.icon}</span>
        <div><h1>{props.title}</h1><p>{props.subtitle}</p></div>
        {props.action}
      </header>
      <div className="page-content">{props.children}</div>
    </div>
  );
}

function InboxPage(props: {
  readonly onOpenTask: (id: string) => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [items, setItems] = useState<readonly InboxItem[]>([]);
  const refresh = useCallback(() => {
    void api.listInbox().then(setItems).catch((cause) => props.onError(messageOf(cause)));
  }, [props.onError]);
  useEffect(refresh, [refresh]);
  return (
    <PageFrame icon={<Inbox />} title="收件箱" subtitle="自动化结果、需要处理的任务和后台通知。">
      <div className="card-list">
        {items.map((item) => (
          <button key={item.id} className={`inbox-card ${item.status}${item.unread ? ' unread' : ''}`} onClick={() => {
            void api.markInboxRead(item.id).then(refresh);
            if (item.sessionId !== undefined) props.onOpenTask(item.sessionId);
          }}>
            <span className="status-dot" />
            <div><strong>{item.title}</strong><p>{item.detail}</p><small>{formatRelative(item.createdAt)}</small></div>
            <ChevronRight size={16} />
          </button>
        ))}
        {items.length === 0 ? <EmptyState icon={<Inbox />} title="收件箱为空" body="Scheduled 任务的结果会出现在这里。" /> : null}
      </div>
    </PageFrame>
  );
}

function ScheduledPage(props: {
  readonly project?: ProjectSummary;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [items, setItems] = useState<readonly Automation[]>([]);
  const [creating, setCreating] = useState(false);
  const refresh = useCallback(() => {
    void api.listAutomations().then(setItems).catch((cause) => props.onError(messageOf(cause)));
  }, [props.onError]);
  useEffect(refresh, [refresh]);
  return (
    <PageFrame
      icon={<Clock3 />}
      title="已安排"
      subtitle="在本机或隔离 Worktree 中按计划运行任务。"
      action={<button className="primary-button" onClick={() => setCreating(true)}><Plus size={14} /> 新建安排</button>}
    >
      <div className="automation-grid">
        {items.map((item) => (
          <article className="automation-card" key={item.id}>
            <div className="automation-icon"><Clock3 size={18} /></div>
            <div className="automation-copy">
              <strong>{item.name}</strong>
              <p>{item.prompt}</p>
              <span>{item.schedule} · 下次 {formatRelative(item.nextRunAt)}</span>
            </div>
            <div className="automation-actions">
              <button aria-label={`立即运行 ${item.name}`} onClick={() => void api.runAutomation(item.id).catch((cause) => props.onError(messageOf(cause)))} title="立即运行"><Play size={14} /></button>
              <button onClick={() => void api.saveAutomation({ ...item, enabled: !item.enabled }).then(refresh)}>{item.enabled ? '暂停' : '启用'}</button>
              <button aria-label={`删除安排 ${item.name}`} onClick={() => void api.deleteAutomation(item.id).then(refresh)} title="删除安排"><Trash2 size={14} /></button>
            </div>
          </article>
        ))}
        {items.length === 0 ? <EmptyState icon={<Clock3 />} title="还没有安排" body="创建代码审查、依赖更新或定期报告。" /> : null}
      </div>
      {creating ? <AutomationModal project={props.project} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refresh(); }} onError={props.onError} /> : null}
    </PageFrame>
  );
}

function AutomationModal(props: {
  readonly project?: ProjectSummary;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState('every:1d');
  return (
    <Modal title="新建安排" onClose={props.onClose}>
      <label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="每日代码健康检查" /></label>
      <label>任务<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="检查最近改动并修复确定的问题…" /></label>
      <label>计划<input value={schedule} onChange={(event) => setSchedule(event.target.value)} placeholder="every:1d 或 RRULE:FREQ=DAILY" /></label>
      <div className="modal-actions">
        <button onClick={props.onClose}>取消</button>
        <button className="primary-button" disabled={props.project === undefined || name.length === 0 || prompt.length === 0} onClick={() => {
          if (props.project === undefined) return;
          void api.saveAutomation({
            name,
            prompt,
            projectPath: props.project.workDir,
            schedule,
            nextRunAt: Date.now(),
            enabled: true,
            mode: 'new-task',
            target: 'worktree',
          }).then(props.onSaved).catch((cause) => props.onError(messageOf(cause)));
        }}>保存</button>
      </div>
    </Modal>
  );
}

function PluginsPage(props: {
  readonly session?: SessionSnapshot;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [plugins, setPlugins] = useState<readonly PluginView[]>([]);
  const [skills, setSkills] = useState<readonly SkillView[]>([]);
  const [commands, setCommands] = useState<readonly PluginCommandView[]>([]);
  const [mcp, setMcp] = useState<readonly McpServerView[]>([]);
  const [source, setSource] = useState('');
  const [installTarget, setInstallTarget] = useState<string>();
  const [removeTarget, setRemoveTarget] = useState<PluginView>();
  const refresh = useCallback(() => {
    void Promise.all([
      api.listPlugins(props.session?.id),
      api.listSkills(props.session?.id, props.session?.workDir),
      props.session === undefined ? Promise.resolve([]) : api.listPluginCommands(props.session.id),
      props.session === undefined ? Promise.resolve([]) : api.listMcp(props.session.id),
    ]).then(([nextPlugins, nextSkills, nextCommands, nextMcp]) => {
      setPlugins(nextPlugins);
      setSkills(nextSkills);
      setCommands(nextCommands);
      setMcp(nextMcp);
    }).catch((cause) => props.onError(messageOf(cause)));
  }, [props.session?.id, props.session?.workDir, props.onError]);
  useEffect(refresh, [refresh]);
  const mutate = (operation: Promise<void>): void => {
    void operation.then(refresh).catch((cause) => props.onError(messageOf(cause)));
  };
  return (
    <>
      <PageFrame icon={<Plug />} title="插件与技能" subtitle="扩展 Ganymede 的工具、Skill、命令和 MCP 连接。">
        <div className="install-row">
          <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="本地路径、GitHub URL 或插件 ZIP" />
          <button className="primary-button" disabled={source.trim().length === 0} onClick={() => setInstallTarget(source.trim())}>安装</button>
        </div>
        <h2>已安装插件</h2>
        <div className="tile-grid">
          {plugins.map((plugin) => (
            <article className={`plugin-tile${plugin.hasErrors ? ' error' : ''}`} key={plugin.id}>
              <span className="plugin-logo"><Boxes size={20} /></span>
              <div className="plugin-details">
                <strong>{plugin.name}</strong>
                <p>{plugin.description ?? plugin.id}</p>
                <small>{plugin.skillCount} Skills · {plugin.commandCount} 命令 · {plugin.enabledMcpServerCount}/{plugin.mcpServerCount} MCP · {plugin.hookCount} Hooks</small>
                {plugin.diagnostics.map((diagnostic, index) => (
                  <small className={`plugin-diagnostic ${diagnostic.severity}`} key={`${diagnostic.message}:${index.toString()}`}>{diagnostic.message}</small>
                ))}
              </div>
              <div className="plugin-actions">
                <button
                  disabled={plugin.id === 'ganymede-desktop'}
                  onClick={() => mutate(api.enablePlugin(plugin.id, !plugin.enabled, props.session?.id))}
                >
                  {plugin.enabled ? '停用' : '启用'}
                </button>
                {plugin.id === 'ganymede-desktop' ? null : (
                  <button className="danger" onClick={() => setRemoveTarget(plugin)}><Trash2 size={11} /> 移除</button>
                )}
              </div>
              {plugin.mcpServers.length > 0 ? (
                <div className="plugin-mcp-list">
                  {plugin.mcpServers.map((server) => (
                    <label key={server.name}>
                      <span><Server size={12} /> {server.name}<small>{server.transport}</small></span>
                      <input
                        checked={server.enabled}
                        onChange={(event) => mutate(api.enablePluginMcp(plugin.id, server.name, event.target.checked, props.session?.id))}
                        type="checkbox"
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <h2>可用 Skills</h2>
        <div className="skill-list">{skills.map((skill) => (
          <div key={skill.name}>
            <WandSparkles size={14} />
            <span><strong>{skill.name}</strong><small>{skill.description} · {skill.source ?? 'unknown'}{skill.type === undefined ? '' : ` · ${skill.type}`}</small></span>
            {skill.userActivatable ? (
              <button
                disabled={props.session === undefined}
                onClick={() => props.session && mutate(api.activateSkill(props.session.id, skill.name))}
              >运行</button>
            ) : <small>仅供模型</small>}
          </div>
        ))}</div>
        <h2>Plugin Commands</h2>
        <div className="skill-list">{commands.map((command) => (
          <div key={`${command.pluginId}:${command.name}`}>
            <Command size={14} />
            <span><strong>/{command.pluginId}:{command.name}</strong><small>{command.description}</small></span>
            <button onClick={() => props.session && mutate(api.activatePluginCommand(props.session.id, command.pluginId, command.name))}>运行</button>
          </div>
        ))}</div>
        <h2>MCP 连接</h2>
        <div className="skill-list">{mcp.map((server) => <div key={server.name}><span className={`connection ${server.status}`} /><span><strong>{server.name}</strong><small>{server.status} · {server.toolCount} tools{server.error === undefined ? '' : ` · ${server.error}`}</small></span><button onClick={() => props.session && mutate(api.reconnectMcp(props.session.id, server.name))}>重连</button></div>)}</div>
      </PageFrame>
      {installTarget !== undefined ? (
        <ConfirmSheet
          title="信任并安装插件"
          body={`插件可以加载 Skills、命令、Hooks 和 MCP 服务，并可能执行本地程序。仅在信任来源时安装：${installTarget}`}
          confirmLabel="信任并安装"
          onClose={() => setInstallTarget(undefined)}
          onConfirm={() => {
            const target = installTarget;
            setInstallTarget(undefined);
            void api.installPlugin(target, props.session?.id)
              .then(() => {
                setSource('');
                refresh();
              })
              .catch((cause) => props.onError(messageOf(cause)));
          }}
        />
      ) : null}
      {removeTarget !== undefined ? (
        <ConfirmSheet
          title="移除插件"
          body={`确定移除“${removeTarget.name}”吗？插件提供的 Skills、命令与 MCP 将从后续任务中移除。`}
          confirmLabel="移除插件"
          danger
          onClose={() => setRemoveTarget(undefined)}
          onConfirm={() => {
            const target = removeTarget;
            setRemoveTarget(undefined);
            mutate(api.removePlugin(target.id, props.session?.id));
          }}
        />
      ) : null}
    </>
  );
}

function SitesPage(props: { readonly onError: (message: string) => void }): ReactNode {
  const [sites, setSites] = useState<readonly SiteRecord[]>([]);
  const [path, setPath] = useState('');
  const [title, setTitle] = useState('');
  const refresh = useCallback(() => { void api.listSites().then(setSites).catch((cause) => props.onError(messageOf(cause))); }, [props.onError]);
  useEffect(refresh, [refresh]);
  return (
    <PageFrame icon={<Globe2 />} title="Sites" subtitle="预览、标注并导出代理生成的本地交互式站点。">
      <div className="install-row">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="站点名称" />
        <input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/absolute/path/to/site" />
        <button className="primary-button" disabled={!title || !path} onClick={() => void api.saveSite({ title, path }).then(() => { setTitle(''); setPath(''); refresh(); })}>添加</button>
      </div>
      <div className="site-grid">
        {sites.map((site) => (
          <article className="site-card" key={site.id}>
            <div className="site-preview"><Globe2 size={34} /></div>
            <strong>{site.title}</strong><p>{site.path}</p>
            <div>
              <button onClick={() => void api.serveSite(site.id).then((served) => { if (served.url) void api.openExternal(served.url); refresh(); }).catch((cause) => props.onError(messageOf(cause)))}><Play size={13} /> 预览</button>
              <button onClick={() => void api.serveSite(site.id, true).then((served) => { navigator.clipboard.writeText(served.url ?? ''); refresh(); }).catch((cause) => props.onError(messageOf(cause)))}>局域网分享</button>
              {site.url !== undefined ? <button onClick={() => void api.openExternal(site.url!)}>打开</button> : null}
            </div>
          </article>
        ))}
      </div>
    </PageFrame>
  );
}

function PullsPage(props: {
  readonly project?: ProjectSummary;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [pulls, setPulls] = useState<readonly PullRequestSummary[]>([]);
  const [selected, setSelected] = useState<PullRequestDetail>();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  useEffect(() => {
    if (props.project === undefined) return;
    void api.pullRequests(props.project.workDir).then(setPulls).catch((cause) => props.onError(pullRequestErrorMessage(cause)));
  }, [props.project, props.onError]);
  return (
    <PageFrame
      icon={<GitPullRequest />}
      title="拉取请求"
      subtitle="查看检查、审查意见并让代理修复反馈。"
      action={<button className="primary-button" onClick={() => setCreating((value) => !value)}><Plus size={14} /> 创建 PR</button>}
    >
      {creating && props.project !== undefined ? (
        <div className="pr-create">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="PR 标题" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="说明改动、验证与风险" />
          <button className="primary-button" disabled={!title.trim()} onClick={() => void api.createPullRequest(props.project!.workDir, title, body).then((url) => { setCreating(false); setTitle(''); setBody(''); void api.openExternal(url); }).catch((cause) => props.onError(pullRequestErrorMessage(cause)))}>创建并打开</button>
        </div>
      ) : null}
      <div className="card-list">
        {pulls.map((pull) => (
          <button className="pr-card" key={pull.number} onClick={() => props.project && void api.pullRequestDetail(props.project.workDir, pull.number).then(setSelected).catch((cause) => props.onError(pullRequestErrorMessage(cause)))}>
            <GitPullRequest size={17} /><div><strong>#{pull.number} {pull.title}</strong><span>{pull.headRefName} → {pull.baseRefName}</span><small>{pull.author} · {pull.checks ?? pull.reviewDecision ?? pull.state}</small></div><ChevronRight size={16} />
          </button>
        ))}
        {props.project !== undefined && pulls.length === 0 ? <EmptyState icon={<GitPullRequest />} title="没有打开的 PR" body="需要已安装并登录的 GitHub CLI。" /> : null}
      </div>
      {selected !== undefined ? (
        <Modal title={`#${String(selected.number)} ${selected.title}`} onClose={() => setSelected(undefined)}>
          <div className="pr-detail">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.body}</ReactMarkdown>
            <h3>审查</h3>
            {selected.reviews.map((review, index) => <div key={`${review.author}:${String(index)}`}><strong>{review.author} · {review.state}</strong><p>{review.body}</p></div>)}
            {selected.comments.map((comment, index) => <div key={`${comment.author}:${String(index)}`}><strong>{comment.author}</strong><p>{comment.body}</p></div>)}
            <h3>文件</h3>
            {selected.files.map((file) => <div className="pr-file" key={file.path}><span>{file.path}</span><code>+{file.additions} −{file.deletions}</code></div>)}
          </div>
          <div className="modal-actions"><button className="primary-button" onClick={() => void api.openExternal(selected.url)}>在 GitHub 打开</button></div>
        </Modal>
      ) : null}
    </PageFrame>
  );
}

function MemoryPage(props: {
  readonly project?: ProjectSummary;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [records, setRecords] = useState<readonly MemoryRecord[]>([]);
  const [query, setQuery] = useState('');
  const [content, setContent] = useState('');
  const refresh = useCallback(() => {
    void api.searchMemories(query, props.project?.workDir).then(setRecords).catch((cause) => props.onError(messageOf(cause)));
  }, [query, props.project?.workDir, props.onError]);
  useEffect(refresh, [refresh]);
  return (
    <PageFrame icon={<Brain />} title="记忆" subtitle="仅存储在本机、可搜索并可随时删除的项目知识。">
      <div className="memory-compose">
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="记录约定、偏好或需要跨任务保留的上下文…" />
        <button className="primary-button" disabled={!content.trim()} onClick={() => void api.saveMemory({ content, projectPath: props.project?.workDir, tags: [] }).then(() => { setContent(''); refresh(); })}>保存记忆</button>
      </div>
      <div className="memory-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索记忆" /></div>
      <div className="memory-grid">
        {records.map((record) => <article key={record.id}><Brain size={15} /><p>{record.content}</p><small>{formatRelative(record.updatedAt)}</small><button aria-label="删除记忆" onClick={() => void api.deleteMemory(record.id).then(refresh)} title="删除记忆"><Trash2 size={13} /></button></article>)}
      </div>
    </PageFrame>
  );
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
          <label>强调色<input type="color" value={props.settings.accent} onChange={(event) => update({ accent: event.target.value })} /></label>
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
          <label>运行中发送消息<select value={props.settings.followUp} onChange={(event) => update({ followUp: event.target.value as AppSettings['followUp'] })}><option value="steer">立即调整当前运行</option><option value="queue">排队到下一轮</option></select></label>
          <label className="toggle"><input type="checkbox" checked={props.settings.notifications} onChange={(event) => update({ notifications: event.target.checked })} />完成时显示系统通知</label>
          <label className="toggle"><input type="checkbox" checked={props.settings.memoryEnabled} onChange={(event) => update({ memoryEnabled: event.target.checked })} />启用本地记忆</label>
        </SettingsSection>
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
}): ReactNode {
  return <div className="empty-state"><span>{props.icon}</span><strong>{props.title}</strong><p>{props.body}</p></div>;
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

function QuestionModal(props: {
  readonly request: PendingQuestion;
  readonly onResolve: (resolution: Parameters<typeof api.resolveQuestion>[0]) => void;
}): ReactNode {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  return (
    <Modal title="Ganymede 需要确认" onClose={() => props.onResolve({ id: props.request.id, answers: {}, cancelled: true })}>
      <div className="question-list">
        {props.request.questions.map((question) => (
          <fieldset key={question.id}>
            <legend>{question.header ?? question.prompt}</legend>
            {question.header !== undefined ? <p>{question.prompt}</p> : null}
            {question.options.map((option) => {
              const selected = answers[question.prompt]?.includes(option.label) === true;
              return (
                <button key={option.label} className={selected ? 'selected' : ''} onClick={() => {
                  setAnswers((current) => {
                    const previous = current[question.prompt] ?? [];
                    const next = question.multiple
                      ? selected ? previous.filter((item) => item !== option.label) : [...previous, option.label]
                      : [option.label];
                    return { ...current, [question.prompt]: next };
                  });
                }}>
                  <span>{selected ? <Check size={13} /> : null}</span><strong>{option.label}</strong><small>{option.description}</small>
                </button>
              );
            })}
          </fieldset>
        ))}
      </div>
      <div className="modal-actions"><button onClick={() => props.onResolve({ id: props.request.id, answers: {}, cancelled: true })}>取消</button><button className="primary-button" onClick={() => props.onResolve({ id: props.request.id, answers })}>提交答案</button></div>
    </Modal>
  );
}

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

function CommandPalette(props: {
  readonly onClose: () => void;
  readonly commands: readonly DesktopCommand[];
}): ReactNode {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filteredCommands = props.commands.filter((item) =>
    fuzzyTextMatch(`${item.slash} ${item.label} ${item.description}`, query),
  );
  const activeIndex = Math.min(selectedIndex, Math.max(filteredCommands.length - 1, 0));
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(filteredCommands.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      filteredCommands[activeIndex]?.onSelect();
      props.onClose();
    }
  };

  return (
    <div className="command-backdrop" role="dialog" aria-modal="true" aria-label="命令面板" onMouseDown={props.onClose}>
      <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-input"><Search size={16} /><input aria-label="输入命令或搜索" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder="输入命令或搜索…" /><kbd>esc</kbd></div>
        <div className="command-results">
          {filteredCommands.map((item, index) => (
            <button
              className={index === activeIndex ? 'active' : undefined}
              key={item.slash}
              onClick={() => { item.onSelect(); props.onClose(); }}
              onMouseEnter={() => { setSelectedIndex(index); }}
            >
              <span>{item.icon}</span>
              <span><strong>{item.label}</strong><small>/{item.slash} · {item.description}</small></span>
              {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toast(props: { readonly message: string; readonly onClose: () => void }): ReactNode {
  return <div className="toast" role="alert"><X size={15} /><span>{props.message}</span><button aria-label="关闭错误提示" onClick={props.onClose} title="关闭"><X size={13} /></button></div>;
}

function GanymedeMark({ size }: { readonly size: number }): ReactNode {
  return (
    <svg className="ganymede-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs><linearGradient id="moon" x1="8" y1="6" x2="38" y2="42"><stop stopColor="#bec9ff" /><stop offset=".48" stopColor="#7788f2" /><stop offset="1" stopColor="#3446b8" /></linearGradient></defs>
      <ellipse cx="24" cy="24" rx="20" ry="9" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".45" transform="rotate(-23 24 24)" />
      <circle cx="24" cy="24" r="12" fill="url(#moon)" />
      <path d="M17 18c4 3 9 1 13 4M19 29c4-2 7 2 11 0" fill="none" stroke="#e9edff" strokeWidth="1.2" opacity=".55" />
      <circle cx="40" cy="16" r="2.4" fill="#b8c4ff" />
    </svg>
  );
}

function panelLabel(panel: Exclude<Panel, 'none'>): string {
  return { summary: '任务摘要', review: '审查改动', files: '文件', terminal: '终端', browser: '浏览器', agents: 'Agent 集群' }[panel];
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
  update: (value: number) => void,
  storageKey: string,
): void {
  let latest = startSize;
  document.body.classList.add('resizing-horizontal');
  const onMove = (event: PointerEvent): void => {
    latest = Math.max(minimum, Math.min(maximum, startSize + (event.clientX - startCoordinate) * direction));
    update(latest);
  };
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.classList.remove('resizing-horizontal');
    window.localStorage.setItem(storageKey, String(Math.round(latest)));
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
}

function beginVerticalResize(
  startCoordinate: number,
  startSize: number,
  minimum: number,
  maximum: number,
  update: (value: number) => void,
  storageKey: string,
): void {
  let latest = startSize;
  document.body.classList.add('resizing-vertical');
  const onMove = (event: PointerEvent): void => {
    latest = Math.max(minimum, Math.min(maximum, startSize - (event.clientY - startCoordinate)));
    update(latest);
  };
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.classList.remove('resizing-vertical');
    window.localStorage.setItem(storageKey, String(Math.round(latest)));
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fileAttachment(file: File): Promise<PromptAttachment> {
  const path = (file as File & { readonly path?: string }).path ?? file.name;
  const kind: PromptAttachment['kind'] = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
  const dataUrl = kind === 'file' ? undefined : await readDataUrl(file);
  return { kind, name: file.name, path, dataUrl };
}

function patchStatusFromEvent(
  status: SessionStatusView,
  event: Readonly<Record<string, unknown>>,
): SessionStatusView {
  const type = String(event['type'] ?? '');
  if (type === 'turn.started') return { ...status, running: true };
  if (type === 'turn.ended' || type === 'error') return { ...status, running: false };
  if (type !== 'agent.status.updated') return status;

  const eventMode = asInteractionMode(event['interactionMode']);
  const planMode = typeof event['planMode'] === 'boolean' ? event['planMode'] : undefined;
  const swarmMode = typeof event['swarmMode'] === 'boolean' ? event['swarmMode'] : undefined;
  const askMode = typeof event['askMode'] === 'boolean' ? event['askMode'] : undefined;
  const debugMode = typeof event['debugMode'] === 'boolean' ? event['debugMode'] : undefined;
  const hasModePatch =
    eventMode !== undefined ||
    planMode !== undefined ||
    swarmMode !== undefined ||
    askMode !== undefined ||
    debugMode !== undefined;
  const interactionMode = hasModePatch
    ? resolveInteractionMode({
        interactionMode: eventMode,
        planMode: planMode ?? status.planMode,
        swarmMode: swarmMode ?? status.swarmMode,
        askMode: askMode ?? status.askMode,
        debugMode: debugMode ?? status.debugMode,
      })
    : status.interactionMode;

  return {
    ...status,
    model: typeof event['model'] === 'string' ? event['model'] : status.model,
    permission:
      event['permission'] === 'manual' ||
      event['permission'] === 'auto' ||
      event['permission'] === 'yolo'
        ? event['permission']
        : status.permission,
    interactionMode,
    planMode: planMode ?? (hasModePatch ? interactionMode === 'plan' : status.planMode),
    swarmMode: swarmMode ?? (hasModePatch ? interactionMode === 'multitask' : status.swarmMode),
    askMode: askMode ?? (hasModePatch ? interactionMode === 'ask' : status.askMode),
    debugMode: debugMode ?? (hasModePatch ? interactionMode === 'debug' : status.debugMode),
    contextTokens:
      typeof event['contextTokens'] === 'number' ? event['contextTokens'] : status.contextTokens,
    maxContextTokens:
      typeof event['maxContextTokens'] === 'number'
        ? event['maxContextTokens']
        : status.maxContextTokens,
  };
}

function asInteractionMode(value: unknown): InteractionMode | undefined {
  return value === 'agent' ||
    value === 'plan' ||
    value === 'debug' ||
    value === 'multitask' ||
    value === 'ask'
    ? value
    : undefined;
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolveRead, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read attachment.'));
    reader.onload = () => resolveRead(String(reader.result));
    reader.readAsDataURL(file);
  });
}

const systemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');

systemThemeQuery.addEventListener('change', () => {
  const root = document.documentElement;
  if (root.dataset['themeSource'] === 'system') {
    root.dataset['theme'] = systemThemeQuery.matches ? 'light' : 'dark';
  }
});

function applyTheme(settings: AppSettings): void {
  document.documentElement.dataset['themeSource'] = settings.theme;
  document.documentElement.dataset['theme'] = settings.theme === 'system'
    ? systemThemeQuery.matches ? 'light' : 'dark'
    : settings.theme;
  document.documentElement.style.setProperty('--accent', settings.accent);
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
    'chat',
    'memory',
    'settings',
  ].includes(value);
}

function startDictation(onText: (text: string) => void): void {
  const scope = window as unknown as {
    webkitSpeechRecognition?: new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      processLocally?: boolean;
      onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string }; isFinal?: boolean }> }) => void) | null;
      onerror: ((event: unknown) => void) | null;
      start(): void;
    };
  };
  const Recognition = scope.webkitSpeechRecognition;
  if (Recognition === undefined) {
    throw new Error('当前系统不支持设备端听写。');
  }
  const recognition = new Recognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = false;
  if ('processLocally' in recognition) recognition.processLocally = true;
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();
    if (transcript !== undefined && transcript.length > 0) onText(transcript);
  };
  recognition.onerror = () => {};
  recognition.start();
}
