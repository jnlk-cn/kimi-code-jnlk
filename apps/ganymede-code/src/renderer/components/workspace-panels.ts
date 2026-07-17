import type { ComponentType } from 'react';
import {
  Boxes,
  Brain,
  Clock3,
  FileDiff,
  FileText,
  GitPullRequest,
  Globe2,
  Inbox,
  ListTodo,
  RefreshCw,
  Sparkles,
  TerminalSquare,
  WandSparkles,
} from 'lucide-react';

export type WorkspaceToolPanel =
  | 'summary'
  | 'review'
  | 'plans'
  | 'files'
  | 'terminal'
  | 'browser'
  | 'agents';

export type WorkspaceUtilityPanel =
  | 'inbox'
  | 'scheduled'
  | 'plugins'
  | 'sites'
  | 'pulls'
  | 'git-sync'
  | 'memory';

export type WorkspacePanel = 'none' | WorkspaceToolPanel | WorkspaceUtilityPanel;

export interface WorkspacePanelMeta {
  readonly panel: Exclude<WorkspacePanel, 'none'>;
  readonly label: string;
  readonly shortLabel: string;
  readonly tabLabel: string;
  readonly shortcut: string;
  readonly icon: ComponentType<{ readonly size?: number; readonly className?: string }>;
}

export interface WorkspaceDockSection {
  readonly items: readonly WorkspacePanelMeta[];
}

export const TERMINAL_PANEL_META: WorkspacePanelMeta = {
  panel: 'terminal',
  label: '终端',
  shortLabel: '终端',
  tabLabel: '终端',
  shortcut: '⌘J',
  icon: TerminalSquare,
};

const FILES_PANEL_META: WorkspacePanelMeta = {
  panel: 'files',
  label: '文件',
  shortLabel: '文件',
  tabLabel: '文件',
  shortcut: '⌘P',
  icon: FileText,
};

const BROWSER_PANEL_META: WorkspacePanelMeta = {
  panel: 'browser',
  label: '浏览器',
  shortLabel: '浏览器',
  tabLabel: '浏览器',
  shortcut: '⌘T',
  icon: Globe2,
};

const SUMMARY_PANEL_META: WorkspacePanelMeta = {
  panel: 'summary',
  label: '任务摘要',
  shortLabel: '摘要',
  tabLabel: '摘要',
  shortcut: '⌘⇧S',
  icon: Sparkles,
};

const REVIEW_PANEL_META: WorkspacePanelMeta = {
  panel: 'review',
  label: '审查改动',
  shortLabel: '审阅',
  tabLabel: '审阅',
  shortcut: '⌘⇧G',
  icon: FileDiff,
};

const PLANS_PANEL_META: WorkspacePanelMeta = {
  panel: 'plans',
  label: '计划',
  shortLabel: '计划',
  tabLabel: '计划',
  shortcut: '⌘⇧L',
  icon: ListTodo,
};

const AGENTS_PANEL_META: WorkspacePanelMeta = {
  panel: 'agents',
  label: 'Agent 集群',
  shortLabel: 'Agent',
  tabLabel: 'Agent',
  shortcut: '⌘⇧A',
  icon: Boxes,
};

const INBOX_PANEL_META: WorkspacePanelMeta = {
  panel: 'inbox',
  label: '收件箱',
  shortLabel: '收件箱',
  tabLabel: '收件箱',
  shortcut: '',
  icon: Inbox,
};

const SCHEDULED_PANEL_META: WorkspacePanelMeta = {
  panel: 'scheduled',
  label: '已安排',
  shortLabel: '已安排',
  tabLabel: '已安排',
  shortcut: '',
  icon: Clock3,
};

const PLUGINS_PANEL_META: WorkspacePanelMeta = {
  panel: 'plugins',
  label: '技能与插件',
  shortLabel: '插件',
  tabLabel: '插件',
  shortcut: '',
  icon: WandSparkles,
};

const SITES_PANEL_META: WorkspacePanelMeta = {
  panel: 'sites',
  label: '本地站点',
  shortLabel: '站点',
  tabLabel: '站点',
  shortcut: '',
  icon: Globe2,
};

const MEMORY_PANEL_META: WorkspacePanelMeta = {
  panel: 'memory',
  label: '记忆',
  shortLabel: '记忆',
  tabLabel: '记忆',
  shortcut: '',
  icon: Brain,
};

const PULLS_PANEL_META: WorkspacePanelMeta = {
  panel: 'pulls',
  label: '拉取请求',
  shortLabel: 'PR',
  tabLabel: 'PR',
  shortcut: '',
  icon: GitPullRequest,
};

const GIT_SYNC_PANEL_META: WorkspacePanelMeta = {
  panel: 'git-sync',
  label: 'Git同步',
  shortLabel: '同步',
  tabLabel: '同步',
  shortcut: '',
  icon: RefreshCw,
};

/** Right-rail dock sections: dev tools → task flow → inbox/schedule → extensions → git. */
export const WORKSPACE_DOCK_SECTIONS: readonly WorkspaceDockSection[] = [
  { items: [TERMINAL_PANEL_META, FILES_PANEL_META, BROWSER_PANEL_META] },
  { items: [SUMMARY_PANEL_META, REVIEW_PANEL_META, PLANS_PANEL_META, AGENTS_PANEL_META] },
  { items: [INBOX_PANEL_META, SCHEDULED_PANEL_META] },
  { items: [PLUGINS_PANEL_META, SITES_PANEL_META, MEMORY_PANEL_META] },
  { items: [PULLS_PANEL_META, GIT_SYNC_PANEL_META] },
];

export const WORKSPACE_TOOL_PANEL_MENU: readonly WorkspacePanelMeta[] =
  WORKSPACE_DOCK_SECTIONS.slice(0, 2).flatMap((section) => section.items);

export const WORKSPACE_UTILITY_PANEL_MENU: readonly WorkspacePanelMeta[] =
  WORKSPACE_DOCK_SECTIONS.slice(2).flatMap((section) => section.items);

export const WORKSPACE_UTILITY_PANELS: readonly WorkspaceUtilityPanel[] =
  WORKSPACE_UTILITY_PANEL_MENU.map((item) => item.panel as WorkspaceUtilityPanel);

export const WORKSPACE_PANEL_MENU: readonly WorkspacePanelMeta[] = [
  ...WORKSPACE_TOOL_PANEL_MENU,
  ...WORKSPACE_UTILITY_PANEL_MENU,
];

export function isUtilityPanel(panel: WorkspacePanel): panel is WorkspaceUtilityPanel {
  return WORKSPACE_UTILITY_PANELS.includes(panel as WorkspaceUtilityPanel);
}

export function isUtilityRoute(value: string): value is WorkspaceUtilityPanel {
  return WORKSPACE_UTILITY_PANELS.includes(value as WorkspaceUtilityPanel);
}

export function isToolPanel(panel: WorkspacePanel): panel is WorkspaceToolPanel {
  return panel !== 'none' && !isUtilityPanel(panel);
}

export function workspacePanelMeta(
  panel: Exclude<WorkspacePanel, 'none'>,
): WorkspacePanelMeta {
  return WORKSPACE_PANEL_MENU.find((item) => item.panel === panel) ?? TERMINAL_PANEL_META;
}

export function panelLabel(panel: Exclude<WorkspacePanel, 'none'>): string {
  return workspacePanelMeta(panel).label;
}

export function panelTabLabel(panel: Exclude<WorkspacePanel, 'none'>): string {
  return workspacePanelMeta(panel).tabLabel;
}

export function toggleWorkspacePanel(
  current: WorkspacePanel,
  target: Exclude<WorkspacePanel, 'none'>,
): WorkspacePanel {
  return current === target ? 'none' : target;
}
