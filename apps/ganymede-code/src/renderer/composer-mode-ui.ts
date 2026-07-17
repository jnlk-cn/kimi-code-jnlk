import type { ExecutionTarget, InteractionMode } from '../shared/contracts';

/** Cursor-style Shift+Tab cycle — Engineering is menu/slash only. */
export const INTERACTION_MODE_SHIFT_TAB_CYCLE: readonly InteractionMode[] = [
  'agent',
  'plan',
  'debug',
  'multitask',
  'ask',
];

/** Mode menu order: core modes first, then Engineering as a Ganymede extension. */
export const INTERACTION_MODE_MENU_ORDER: readonly InteractionMode[] = [
  'agent',
  'plan',
  'debug',
  'multitask',
  'ask',
  'engineering',
];

/** @deprecated Use INTERACTION_MODE_SHIFT_TAB_CYCLE. */
export const INTERACTION_MODE_CYCLE = INTERACTION_MODE_SHIFT_TAB_CYCLE;

export function nextShiftTabInteractionMode(current: InteractionMode): InteractionMode {
  const index = INTERACTION_MODE_SHIFT_TAB_CYCLE.indexOf(current);
  if (index < 0) return 'agent';
  return INTERACTION_MODE_SHIFT_TAB_CYCLE[(index + 1) % INTERACTION_MODE_SHIFT_TAB_CYCLE.length]!;
}

/** @deprecated Use nextShiftTabInteractionMode. */
export function nextInteractionMode(current: InteractionMode): InteractionMode {
  return nextShiftTabInteractionMode(current);
}

export function interactionModeClassName(mode: InteractionMode): string {
  return `mode-${mode}`;
}

const IDLE_PLACEHOLDERS: Readonly<Record<InteractionMode, string>> = {
  agent: '描述要构建、修复或探索的任务…',
  plan: '描述目标，代理会先只读探索并撰写可审阅的实现计划…',
  debug: '描述要诊断的问题或失败现象…',
  multitask: '描述可并行拆分的任务，代理会协调多个子任务…',
  ask: '围绕当前项目提问或讨论（只读，不会修改文件）…',
  engineering: '描述工程目标，按设计 → 计划 → TDD → 执行 → 评审流程推进…',
};

export function composerPlaceholder(
  mode: InteractionMode,
  options: { readonly running: boolean; readonly steerShortcut: string },
): string {
  if (options.running) {
    return `输入后续指示以排队，${options.steerShortcut} 立即注入当前运行…`;
  }
  return IDLE_PLACEHOLDERS[mode];
}

function targetHintLabel(target: ExecutionTarget): string {
  if (target === 'worktree') return 'Worktree';
  if (target === 'ssh') return '远程 SSH';
  return '本地工作区';
}

export function modeSwitchShortcutLabel(platform: NodeJS.Platform | undefined): string {
  return platform === 'darwin' ? '⌘.' : 'Ctrl+.';
}

export function composerFooterHint(input: {
  readonly target: ExecutionTarget;
  readonly running: boolean;
  readonly steerShortcut: string;
  readonly platform?: NodeJS.Platform;
}): string {
  const target = targetHintLabel(input.target);
  if (input.running) {
    return `${target} · Enter 排队 · ${input.steerShortcut} 立即注入 · Shift+Enter 换行`;
  }
  const modeShortcut = modeSwitchShortcutLabel(input.platform);
  return `${target} · Enter 发送 · Shift+Enter 换行 · Shift+Tab 切换模式 · ${modeShortcut} 打开模式菜单`;
}

export function interactionModeMenuDescription(
  mode: InteractionMode,
  description: string,
  running: boolean,
): string {
  if (running) return '任务运行中无法切换工作模式，请先停止当前任务';
  if (mode === 'engineering') {
    return `${description} · 仅菜单或 /engineering · 不参与 Shift+Tab`;
  }
  return `${description} · Shift+Tab`;
}

const COMPOSER_MODE_HINTS: Partial<Readonly<Record<InteractionMode, string>>> = {
  plan: '计划模式：代理会先只读探索代码并撰写方案，不会修改项目文件。方案就绪后请你确认「开始构建」。',
  engineering:
    '工程模式：按设计 → 计划 → TDD → 执行 → 评审的系统化流程推进，会启用更多子代理与工具调用，Tokens 消耗通常高于普通助理模式。',
  ask: '聊天模式：围绕当前项目问答与讨论，代理只读探索代码，不会修改项目文件。',
  debug:
    '排障模式：先收集运行时证据再修复。修复后会请你按步骤手动验证，并确认问题是否已解决。',
};

export function composerModeHint(
  mode: InteractionMode,
  options: { readonly running: boolean; readonly planApprovalPending: boolean },
): string | undefined {
  if (options.running) return undefined;
  if (mode === 'plan' && options.planApprovalPending) return undefined;
  return COMPOSER_MODE_HINTS[mode];
}
