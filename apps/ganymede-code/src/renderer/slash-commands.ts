import type {
  InteractionMode,
  PermissionMode,
  SessionSnapshot,
  SessionStatusView,
  SessionUsageView,
} from '../shared/contracts';
import { resolvePermissionToggle } from './permission-ui';

export type ComposerMenuKind = 'permission' | 'model' | 'mode';

export interface ParsedSlashInput {
  readonly name: string;
  readonly args: string;
}

export function parseSlashInput(input: string): ParsedSlashInput | null {
  const match = /^\/([a-z0-9][a-z0-9_:/.-]*)(?:\s+([\s\S]*))?$/iu.exec(input.trim());
  if (match?.[1] === undefined) return null;
  return {
    name: match[1].toLocaleLowerCase(),
    args: match[2]?.trim() ?? '',
  };
}

const INTERACTION_MODES: readonly InteractionMode[] = [
  'agent',
  'engineering',
  'plan',
  'debug',
  'multitask',
  'ask',
];

export function isInteractionMode(value: string): value is InteractionMode {
  return (INTERACTION_MODES as readonly string[]).includes(value);
}

/** Commands that must not run while a turn is streaming. */
const IDLE_ONLY_COMMANDS = new Set([
  'compact',
  'init',
  'new',
  'fork',
  'clear',
]);

const MODEL_NOT_SET_MESSAGE =
  '尚未配置模型。请在设置中登录 Kimi 模型账号，或添加兼容的模型服务。';

export function slashBusyMessage(commandName: string): string {
  return `任务运行中无法执行 /${commandName}，请先停止当前任务。`;
}

export interface SlashCommandHost {
  readonly session: SessionSnapshot | undefined;
  readonly draftPermission: PermissionMode;
  readonly draftInteractionMode: InteractionMode;
  readonly bootVersion?: string;
  readonly workDir?: string;
  showError(message: string): void;
  showNotice(message: string): void;
  applyPermissionMode(mode: PermissionMode): Promise<void>;
  applyInteractionMode(mode: InteractionMode): Promise<boolean>;
  openComposerMenu(kind: ComposerMenuKind): void;
  handleSwarmCommand(args: string): Promise<void>;
  compactSession(sessionId: string, instruction?: string): Promise<void>;
  initSession(sessionId: string): Promise<void>;
  getSessionUsage(sessionId: string): Promise<SessionUsageView>;
  clearSessionPlan(sessionId: string): Promise<void>;
  appendStatus(title: string, content: string): void;
}

/**
 * Handle Kimi-aligned slash commands. Returns `true` when the input was
 * recognized and handled (including no-ops / errors that should clear the
 * composer). Returns `false` when the caller should continue with desktop-
 * specific or skill/plugin commands.
 */
export async function handleAlignedSlashCommand(
  host: SlashCommandHost,
  text: string,
): Promise<boolean> {
  const parsed = parseSlashInput(text);
  if (parsed === null) return false;

  const { name, args } = parsed;
  const alias = name === 'yes' ? 'yolo' : name === 'clear' ? 'new' : name;

  if (IDLE_ONLY_COMMANDS.has(alias) && host.session?.status.running === true) {
    host.showError(slashBusyMessage(alias));
    return true;
  }

  switch (alias) {
    case 'permission':
      host.openComposerMenu('permission');
      return true;
    case 'model':
      host.openComposerMenu('model');
      return true;
    case 'mode':
      return handleModeSlash(host, args);
    case 'auto':
      return handlePermissionToggle(host, 'auto', args);
    case 'yolo':
      return handlePermissionToggle(host, 'yolo', args);
    case 'plan':
      return handlePlanSlash(host, args);
    case 'compact':
      return handleCompactSlash(host, args);
    case 'init':
      return handleInitSlash(host);
    case 'status':
      return handleStatusSlash(host);
    case 'usage':
      return handleUsageSlash(host);
    default:
      return false;
  }
}

async function handlePermissionToggle(
  host: SlashCommandHost,
  target: 'auto' | 'yolo',
  args: string,
): Promise<boolean> {
  const current = host.session?.status.permission ?? host.draftPermission;
  const result = resolvePermissionToggle(current, target, args);
  if ('already' in result) {
    host.showNotice(result.already);
    return true;
  }
  await host.applyPermissionMode(result.next);
  host.showNotice(result.notice);
  return true;
}

async function handleModeSlash(host: SlashCommandHost, args: string): Promise<boolean> {
  const trimmed = args.trim().toLowerCase();
  if (trimmed.length === 0) {
    host.openComposerMenu('mode');
    return true;
  }
  if (!isInteractionMode(trimmed)) {
    host.showError(
      `未知模式：${trimmed}。可用 agent、engineering、plan、debug、multitask 或 ask。`,
    );
    return true;
  }
  if (trimmed === 'multitask') {
    await host.handleSwarmCommand('on');
    return true;
  }
  await host.applyInteractionMode(trimmed);
  return true;
}

async function handlePlanSlash(host: SlashCommandHost, args: string): Promise<boolean> {
  const subcmd = args.trim().toLowerCase();
  if (subcmd === 'clear') {
    if (host.session === undefined) {
      host.showError('请先打开一个任务。');
      return true;
    }
    if (host.session.status.running) {
      host.showError(slashBusyMessage('plan clear'));
      return true;
    }
    await host.clearSessionPlan(host.session.id);
    host.showNotice('已清除当前计划。');
    return true;
  }

  let enabled: boolean;
  if (subcmd.length === 0) {
    const current =
      host.session?.status.interactionMode ?? host.draftInteractionMode;
    enabled = current !== 'plan';
  } else if (subcmd === 'on') {
    enabled = true;
  } else if (subcmd === 'off') {
    enabled = false;
  } else {
    host.showError(`未知 plan 参数：${subcmd}。可用 on / off / clear，或不带参数切换。`);
    return true;
  }

  await host.applyInteractionMode(enabled ? 'plan' : 'agent');
  host.showNotice(enabled ? '计划模式：开启' : '计划模式：关闭');
  return true;
}

async function handleCompactSlash(
  host: SlashCommandHost,
  args: string,
): Promise<boolean> {
  if (host.session === undefined) {
    host.showError('请先打开一个任务。');
    return true;
  }
  const instruction = args.trim() || undefined;
  await host.compactSession(host.session.id, instruction);
  host.showNotice('正在压缩对话上下文…');
  return true;
}

async function handleInitSlash(host: SlashCommandHost): Promise<boolean> {
  if (host.session === undefined) {
    host.showError('请先打开一个任务。');
    return true;
  }
  if ((host.session.status.model ?? '').trim().length === 0) {
    host.showError(MODEL_NOT_SET_MESSAGE);
    return true;
  }
  host.showNotice('正在分析代码库并生成 AGENTS.md…');
  await host.initSession(host.session.id);
  return true;
}

async function handleStatusSlash(host: SlashCommandHost): Promise<boolean> {
  const status = host.session?.status;
  const lines = [
    `版本：${host.bootVersion ?? '—'}`,
    `模型：${status?.model ?? '—'}`,
    `思考：${status?.thinkingEffort ?? '—'}`,
    `权限：${status?.permission ?? host.draftPermission}`,
    `模式：${status?.interactionMode ?? host.draftInteractionMode}`,
    `工作目录：${host.workDir ?? host.session?.workDir ?? '—'}`,
    `会话：${host.session?.id ?? '（尚未创建）'}`,
    `上下文：${formatContext(status)}`,
  ];
  host.appendStatus('会话状态', lines.join('\n'));
  return true;
}

async function handleUsageSlash(host: SlashCommandHost): Promise<boolean> {
  if (host.session === undefined) {
    host.showError('请先打开一个任务。');
    return true;
  }
  const usage = await host.getSessionUsage(host.session.id);
  const status = host.session.status;
  const lines = [
    `上下文：${formatContext(status)}`,
    ...formatUsageBlock('本轮', usage.currentTurn),
    ...formatUsageBlock('合计', usage.total),
  ];
  if (usage.byModel !== undefined) {
    for (const [model, tokens] of Object.entries(usage.byModel)) {
      lines.push(...formatUsageBlock(model, tokens));
    }
  }
  host.appendStatus('用量', lines.join('\n'));
  return true;
}

function formatContext(status: SessionStatusView | undefined): string {
  if (status === undefined) return '—';
  const used = status.contextTokens;
  const max = status.maxContextTokens;
  if (max <= 0) return `${String(used)} tokens`;
  const pct = Math.round((used / max) * 100);
  return `${String(used)} / ${String(max)} (${String(pct)}%)`;
}

function formatUsageBlock(
  label: string,
  tokens: SessionUsageView['total'],
): readonly string[] {
  if (tokens === undefined) return [];
  const input =
    tokens.inputOther + tokens.inputCacheRead + tokens.inputCacheCreation;
  return [
    `${label}：输入 ${String(input)} · 输出 ${String(tokens.output)} · 缓存命中 ${String(tokens.inputCacheRead)}`,
  ];
}
