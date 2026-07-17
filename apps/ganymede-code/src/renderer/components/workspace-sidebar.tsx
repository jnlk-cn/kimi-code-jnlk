import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  FileText,
  Folder,
  FolderGit2,
  FolderOpen,
  FolderPlus,
  GitBranch,
  MessageSquare,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Server,
  Settings,
  TerminalSquare,
  X,
} from 'lucide-react';

import {
  readGlobalUi,
  writeGlobalUi,
} from '../workspace-ui-persistence';
import type { ProjectSummary, TaskSummary } from '../../shared/contracts';
import {
  AppMenuPopover,
  anchorFromElement,
  type AppMenuItem,
  type MenuAnchor,
} from '../app-menu';

export type WorkspaceRoute =
  | 'new'
  | 'inbox'
  | 'scheduled'
  | 'plugins'
  | 'sites'
  | 'pulls'
  | 'git-sync'
  | 'chat'
  | 'memory'
  | 'settings';

export const DEFAULT_RECENT_TASK_COUNT = 8;

export interface VisibleProjectTasks {
  readonly tasks: readonly TaskSummary[];
  readonly hiddenCount: number;
}

export function visibleProjectTasks(
  tasks: readonly TaskSummary[],
  activeSessionId: string | undefined,
  revealAll: boolean,
  recentLimit = DEFAULT_RECENT_TASK_COUNT,
): VisibleProjectTasks {
  if (revealAll) return { tasks, hiddenCount: 0 };

  const byMostRecent = (left: TaskSummary, right: TaskSummary): number =>
    right.updatedAt - left.updatedAt;
  const pinned = tasks.filter((task) => task.pinned).sort(byMostRecent);
  const recent = tasks
    .filter((task) => !task.pinned)
    .sort(byMostRecent)
    .slice(0, Math.max(0, recentLimit));
  const visible = [...pinned, ...recent];
  const active = tasks.find((task) => task.id === activeSessionId);
  if (active !== undefined && !visible.some((task) => task.id === active.id)) {
    visible.push(active);
  }
  return { tasks: visible, hiddenCount: Math.max(0, tasks.length - visible.length) };
}

export type ProjectListView = 'active' | 'archived';

export interface WorkspaceSidebarProps {
  readonly route: WorkspaceRoute;
  readonly projects: readonly ProjectSummary[];
  readonly archivedProjects: readonly ProjectSummary[];
  readonly tasks: readonly TaskSummary[];
  readonly activeProject?: ProjectSummary;
  readonly activeSessionId?: string;
  readonly activeSessionRunning: boolean;
  readonly onRoute: (route: WorkspaceRoute) => void;
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
  readonly onProjectRestore: (project: ProjectSummary) => void;
  readonly onOpenWorkspacePicker: (anchor: MenuAnchor) => void;
  readonly onNew: () => void;
  readonly onCommand: () => void;
  readonly onClose: () => void;
  readonly onResizeStart: (clientX: number) => void;
  readonly userName: string;
}

export function WorkspaceSidebar(props: WorkspaceSidebarProps): ReactNode {
  const initialSidebarUi = readGlobalUi();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => {
    const stored = new Set(initialSidebarUi.sidebarExpandedProjects);
    if (props.activeProject?.workDir !== undefined) stored.add(props.activeProject.workDir);
    return stored;
  });
  const [revealedAll, setRevealedAll] = useState<ReadonlySet<string>>(
    () => new Set(initialSidebarUi.sidebarRevealedAllProjects),
  );
  const [projectListView, setProjectListView] = useState<ProjectListView>('active');
  const [menu, setMenu] = useState<{
    readonly anchor: MenuAnchor;
    readonly project: ProjectSummary;
    readonly task?: TaskSummary;
    readonly archived?: boolean;
  }>();

  useEffect(() => {
    const workDir = props.activeProject?.workDir;
    if (workDir === undefined) return;
    setExpanded((current) => new Set([...current, workDir]));
  }, [props.activeProject?.workDir]);

  useEffect(() => {
    writeGlobalUi({
      sidebarExpandedProjects: [...expanded],
      sidebarRevealedAllProjects: [...revealedAll],
    });
  }, [expanded, revealedAll]);

  const toggleProject = (workDir: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(workDir)) next.delete(workDir);
      else next.add(workDir);
      return next;
    });
  };

  const toggleAllTasks = (workDir: string): void => {
    setRevealedAll((current) => {
      const next = new Set(current);
      if (next.has(workDir)) next.delete(workDir);
      else next.add(workDir);
      return next;
    });
  };

  const openArchivedProjectMenu = (
    project: ProjectSummary,
    anchor: MenuAnchor,
  ): void => {
    setMenu({ anchor, project, archived: true });
  };

  const menuItems = menu === undefined
    ? []
    : menu.task === undefined
      ? menu.archived
        ? archivedProjectMenuItems(menu.project, props, () => {
            setProjectListView('active');
            props.onProjectRestore(menu.project);
          })
        : projectMenuItems(menu.project, props)
      : taskMenuItems(menu.task, props);

  return (
    <aside className="sidebar" aria-label="项目与任务侧栏">
      <div className="titlebar-drag" />
      <div className="brand-row">
        <button
          className="brand-lockup"
          onClick={props.onNew}
          title="伽利略 Code · GANYMEDE"
          type="button"
        >
          <GanymedeMark size={25} />
          <span className="brand-wordmark">
            <strong className="brand-name"><span>伽利略</span> Code</strong>
            <small className="brand-subtitle">GANYMEDE</small>
          </span>
        </button>
        <button
          aria-label="搜索任务与命令"
          className="icon-button brand-search"
          onClick={props.onCommand}
          title="搜索任务与命令 ⌘K"
          type="button"
        >
          <Search size={15} />
        </button>
        <button
          aria-label="关闭侧栏"
          className="icon-button sidebar-mobile-close"
          onClick={props.onClose}
          title="关闭侧栏"
          type="button"
        >
          <X size={15} />
        </button>
      </div>

      <nav className="primary-nav" aria-label="主要操作">
        <NavButton
          active={props.route === 'new'}
          icon={MessageSquare}
          label="新建任务"
          onClick={props.onNew}
          shortcut="⌘N"
        />
      </nav>

      <header className="sidebar-section-head">
        <div className="segmented-control" role="tablist" aria-label="项目列表视图">
          <button
            aria-selected={projectListView === 'active'}
            className={projectListView === 'active' ? 'selected' : undefined}
            onClick={() => setProjectListView('active')}
            role="tab"
            type="button"
          >
            项目
          </button>
          <button
            aria-selected={projectListView === 'archived'}
            className={projectListView === 'archived' ? 'selected' : undefined}
            onClick={() => setProjectListView('archived')}
            role="tab"
            title="查看已归档项目"
            type="button"
          >
            归档
          </button>
        </div>
        {projectListView === 'active' ? (
          <button
            aria-label="打开项目"
            onClick={(event) => props.onOpenWorkspacePicker(anchorFromElement(event.currentTarget))}
            title="打开项目"
            type="button"
          >
            <FolderPlus size={14} />
          </button>
        ) : null}
      </header>

      <div className="project-list">
        {projectListView === 'archived' ? (
          <>
            {props.archivedProjects.map((project) => (
              <div className="project-group" key={project.workDir}>
                <div
                  className="project-row archived"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openArchivedProjectMenu(project, {
                      kind: 'point',
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                >
                  <div className="project-select" title={project.workDir}>
                    <Archive size={15} />
                    <span>{project.name}</span>
                    <span className="project-count">{project.sessionCount}</span>
                  </div>
                  <button
                    aria-label={`管理归档项目 ${project.name}`}
                    className="project-more"
                    onClick={(event) => openArchivedProjectMenu(
                      project,
                      anchorFromElement(event.currentTarget),
                    )}
                    title="归档项目菜单"
                    type="button"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              </div>
            ))}
            {props.archivedProjects.length === 0 ? (
              <div className="empty-project muted">
                <Archive size={18} />
                <strong>暂无归档项目</strong>
                <small>归档的项目会出现在这里</small>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {props.projects.map((project) => {
              const active = project.workDir === props.activeProject?.workDir;
              const projectTasks = props.tasks.filter((task) => task.workDir === project.workDir);
              const open = expanded.has(project.workDir);
              const showAll = revealedAll.has(project.workDir);
              const visible = visibleProjectTasks(projectTasks, props.activeSessionId, showAll);
              const collapsed = visibleProjectTasks(projectTasks, props.activeSessionId, false);
              const canCollapse = showAll && collapsed.hiddenCount > 0;

              return (
                <div className="project-group" key={project.workDir}>
                  <div
                    className={`project-row${active ? ' active' : ''}`}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setMenu({
                        anchor: { kind: 'point', x: event.clientX, y: event.clientY },
                        project,
                      });
                    }}
                  >
                    <button
                      aria-label={open ? '折叠项目' : '展开项目'}
                      className="project-disclosure"
                      onClick={() => toggleProject(project.workDir)}
                      title={open ? '折叠项目' : '展开项目'}
                      type="button"
                    >
                      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <button
                      className="project-select"
                      onClick={() => {
                        props.onProject(project);
                        setExpanded((current) => new Set([...current, project.workDir]));
                      }}
                      title={project.workDir}
                      type="button"
                    >
                      {project.isGitRepository ? <FolderGit2 size={15} /> : <Folder size={15} />}
                      <span>{project.name}</span>
                      {project.pinned ? <Pin className="project-pin" size={11} /> : null}
                      <span className="project-count">{project.sessionCount}</span>
                    </button>
                    <button
                      aria-label={`管理项目 ${project.name}`}
                      className="project-more"
                      onClick={(event) => setMenu({
                        anchor: anchorFromElement(event.currentTarget),
                        project,
                      })}
                      title="项目菜单"
                      type="button"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>

                  {open ? (
                    <div className="task-list">
                      {visible.tasks.map((task) => {
                        const taskActive = task.id === props.activeSessionId;
                        const running = taskActive && props.activeSessionRunning;
                        return (
                          <div
                            className="task-entry"
                            key={task.id}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              setMenu({
                                anchor: { kind: 'point', x: event.clientX, y: event.clientY },
                                project,
                                task,
                              });
                            }}
                          >
                            <button
                              aria-current={taskActive ? 'page' : undefined}
                              className={`task-row${taskActive ? ' active' : ''}`}
                              onClick={() => props.onTask(task)}
                              title={task.lastPrompt ?? task.title}
                              type="button"
                            >
                              <span
                                aria-hidden="true"
                                className={`task-state${task.unread ? ' unread' : ''}${running ? ' running' : ''}`}
                              />
                              <span className="task-copy">
                                <strong>{task.title}</strong>
                                <small className="task-row-meta">
                                  <span>{formatRelative(task.updatedAt)}</span>
                                  {task.target !== 'local' ? <TaskTarget target={task.target} /> : null}
                                </small>
                              </span>
                              {task.pinned ? <Pin className="task-pin" size={10} /> : null}
                            </button>
                            <button
                              aria-label={`管理任务 ${task.title}`}
                              className="task-more"
                              onClick={(event) => setMenu({
                                anchor: anchorFromElement(event.currentTarget),
                                project,
                                task,
                              })}
                              title="任务菜单"
                              type="button"
                            >
                              <MoreHorizontal size={13} />
                            </button>
                          </div>
                        );
                      })}
                      {projectTasks.length === 0 ? (
                        <small className="empty-task-list">暂无任务</small>
                      ) : null}
                      {visible.hiddenCount > 0 || canCollapse ? (
                        <button
                          className="show-all-tasks"
                          onClick={() => toggleAllTasks(project.workDir)}
                          type="button"
                        >
                          {showAll ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          {showAll ? '收起任务' : `查看其余 ${String(visible.hiddenCount)} 项`}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {props.projects.length === 0 ? (
              <button
                className="empty-project"
                onClick={(event) => props.onOpenWorkspacePicker(anchorFromElement(event.currentTarget))}
                type="button"
              >
                <FolderPlus size={18} />
                <strong>打开第一个项目</strong>
                <small>选择一个目录开始使用 Ganymede</small>
              </button>
            ) : null}
          </>
        )}
      </div>

      <footer className="sidebar-footer">
        <div className="account-button" title="本地工作区">
          <span className="avatar">{props.userName.slice(0, 1).toUpperCase()}</span>
          <span><strong>{props.userName}</strong><small>本地工作区</small></span>
        </div>
        <button
          aria-label="设置"
          className={`icon-button${props.route === 'settings' ? ' active' : ''}`}
          onClick={() => props.onRoute('settings')}
          title="设置"
          type="button"
        >
          <Settings size={16} />
        </button>
      </footer>

      {menu !== undefined ? (
        <AppMenuPopover
          anchor={menu.anchor}
          ariaLabel={
            menu.task !== undefined
              ? '任务菜单'
              : menu.archived
                ? '归档项目菜单'
                : '项目菜单'
          }
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

function NavButton(props: {
  readonly active: boolean;
  readonly icon: React.ComponentType<{ readonly size?: number }>;
  readonly label: string;
  readonly onClick: () => void;
  readonly shortcut?: string;
}): ReactNode {
  const Icon = props.icon;
  return (
    <button
      aria-label={props.label}
      className={`nav-button${props.active ? ' active' : ''}`}
      onClick={props.onClick}
      type="button"
    >
      <span><Icon size={15} /></span>
      <strong>{props.label}</strong>
      {props.shortcut === undefined ? null : <kbd>{props.shortcut}</kbd>}
    </button>
  );
}

function TaskTarget(props: { readonly target: TaskSummary['target'] }): ReactNode {
  if (props.target === 'worktree') {
    return <span className="task-target"><GitBranch size={9} /> Worktree</span>;
  }
  if (props.target === 'ssh') {
    return <span className="task-target"><Server size={9} /> SSH</span>;
  }
  return null;
}

function projectMenuItems(
  project: ProjectSummary,
  props: WorkspaceSidebarProps,
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
    { id: 'remove', label: '归档项目…', icon: <Archive />, danger: true, onSelect: () => props.onProjectRemove(project) },
  ];
}

export function archivedProjectMenuItems(
  project: ProjectSummary,
  props: WorkspaceSidebarProps,
  onRestore: () => void,
): readonly AppMenuItem[] {
  return [
    { id: 'restore', label: '恢复到侧栏', icon: <FolderOpen />, onSelect: onRestore },
    { id: 'reveal', label: '在 Finder 中显示', icon: <Folder />, onSelect: () => props.onProjectReveal(project) },
  ];
}

function taskMenuItems(
  task: TaskSummary,
  props: WorkspaceSidebarProps,
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

export function GanymedeMark({ size }: { readonly size: number }): ReactNode {
  return (
    <svg className="ganymede-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="ganymede-moon" x1="8" y1="6" x2="38" y2="42">
          <stop stopColor="#bec9ff" />
          <stop offset=".48" stopColor="#7788f2" />
          <stop offset="1" stopColor="#3446b8" />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="24" rx="20" ry="9" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".45" transform="rotate(-23 24 24)" />
      <circle cx="24" cy="24" r="12" fill="url(#ganymede-moon)" />
      <path d="M17 18c4 3 9 1 13 4M19 29c4-2 7 2 11 0" fill="none" stroke="#e9edff" strokeWidth="1.2" opacity=".55" />
      <circle cx="40" cy="16" r="2.4" fill="#b8c4ff" />
    </svg>
  );
}

function formatRelative(timestamp: number): string {
  const delta = timestamp - Date.now();
  const absolute = Math.abs(delta);
  if (!Number.isFinite(timestamp)) return '时间未知';
  if (absolute < 60_000) return delta > 0 ? '不到 1 分钟后' : '刚刚';
  if (absolute < 3_600_000) return `${String(Math.round(absolute / 60_000))} 分钟${delta > 0 ? '后' : '前'}`;
  if (absolute < 86_400_000) return `${String(Math.round(absolute / 3_600_000))} 小时${delta > 0 ? '后' : '前'}`;
  return new Date(timestamp).toLocaleDateString();
}
