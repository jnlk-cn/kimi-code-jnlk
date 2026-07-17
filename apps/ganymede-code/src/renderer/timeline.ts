import type { EventEnvelope } from '../shared/contracts';
import {
  agentSwarmResultSummaryFromOutput,
  formatAgentSwarmError,
  formatAgentSwarmSummaryLabel,
} from './agent-swarm';
import { formatStepDebugTimingFromEvent } from './debug-timing';

export { formatStepDebugTimingFromEvent as formatStepDebugTiming } from './debug-timing';

export type TimelineKind =
  | 'user'
  | 'assistant'
  | 'thinking'
  | 'tool'
  | 'status'
  | 'error'
  | 'cron'
  | 'subagent'
  | 'swarm-marker';

export type SwarmMarkerState = 'active' | 'inactive' | 'ended';

export interface TimelineEntry {
  readonly id: string;
  readonly kind: TimelineKind;
  readonly title?: string;
  readonly content: string;
  readonly toolCallId?: string;
  readonly toolArgs?: Record<string, unknown>;
  readonly streaming?: boolean;
  readonly error?: boolean;
  readonly swarmMarker?: SwarmMarkerState;
}

export interface ReduceLiveEventOptions {
  readonly debugMode?: boolean;
  /** When true, foreground AgentSwarm / Agent subagents are omitted from the timeline. */
  readonly suppressForegroundSubagents?: boolean;
}

const MAIN_AGENT_ID = 'main';

const FRAME_BATCHED_EVENT_TYPES = new Set([
  'assistant.delta',
  'thinking.delta',
  'tool.call.delta',
  'tool.progress',
]);

const CHILD_AGENT_STREAM_TYPES = new Set([
  'assistant.delta',
  'thinking.delta',
  'tool.call.started',
  'tool.call.delta',
  'tool.progress',
  'tool.result',
  'hook.result',
  'agent.status.updated',
]);

const SKIP_REPLAY_ORIGINS = new Set([
  'injection',
  'system_trigger',
  'hook_result',
  'compaction_summary',
  'background_task',
  'cron_job',
  'cron_missed',
  'retry',
]);

export function isFrameBatchedTimelineEvent(event: Readonly<Record<string, unknown>>): boolean {
  return FRAME_BATCHED_EVENT_TYPES.has(String(event['type'] ?? ''));
}

/** Child-agent stream events belong in swarm / Agent progress UI, not the main transcript. */
function isForegroundChildAgentStreamEvent(
  event: Readonly<Record<string, unknown>>,
  type: string,
): boolean {
  if (!CHILD_AGENT_STREAM_TYPES.has(type)) return false;
  const agentId = event['agentId'];
  return typeof agentId === 'string' && agentId.length > 0 && agentId !== MAIN_AGENT_ID;
}

export function reduceLiveEvent(
  current: readonly TimelineEntry[],
  envelope: EventEnvelope,
  options: ReduceLiveEventOptions = {},
): readonly TimelineEntry[] {
  const event = envelope.event;
  const type = String(event['type'] ?? '');
  if (
    options.suppressForegroundSubagents !== false &&
    isForegroundChildAgentStreamEvent(event, type)
  ) {
    return current;
  }
  const entries = [...current];
  let changed = false;
  if (type === 'assistant.delta') {
    const delta = String(event['delta'] ?? '');
    const last = entries.at(-1);
    if (last?.kind === 'assistant' && last.streaming === true) {
      entries[entries.length - 1] = { ...last, content: last.content + delta };
      changed = true;
    } else {
      entries.push({
        id: `assistant:${envelope.seq.toString()}`,
        kind: 'assistant',
        content: delta,
        streaming: true,
      });
      changed = true;
    }
  } else if (type === 'thinking.delta') {
    const delta = String(event['delta'] ?? '');
    const last = entries.at(-1);
    if (last?.kind === 'thinking' && last.streaming === true) {
      entries[entries.length - 1] = { ...last, content: last.content + delta };
      changed = true;
    } else if (delta.length > 0) {
      entries.push({
        id: `thinking:${envelope.seq.toString()}`,
        kind: 'thinking',
        content: delta,
        streaming: true,
      });
      changed = true;
    }
  } else if (type === 'tool.call.started') {
    const args = parseToolArgs(event['args']);
    const name = String(event['name'] ?? 'Tool');
    const id = String(event['toolCallId'] ?? '');
    const index = findToolEntryIndex(entries, id);
    if (index >= 0) {
      const previous = entries[index]!;
      // Replayed live events must not reopen a tool card that already finalized.
      if (previous.streaming !== true) return current;
      entries[index] = {
        ...previous,
        title: name,
        content: pretty(event['args']),
        toolArgs: args ?? previous.toolArgs,
        streaming: true,
      };
      changed = true;
    } else {
      entries.push({
        id: `tool:${id || envelope.seq.toString()}`,
        kind: 'tool',
        title: name,
        content: pretty(event['args']),
        toolCallId: id,
        toolArgs: args,
        streaming: true,
      });
      changed = true;
    }
  } else if (type === 'tool.call.delta') {
    const id = String(event['toolCallId'] ?? '');
    const index = entries.findIndex((entry) => entry.toolCallId === id);
    const argumentsPart = String(event['argumentsPart'] ?? '');
    if (index >= 0 && argumentsPart.length > 0) {
      const previous = entries[index]!;
      const content = previous.content + argumentsPart;
      entries[index] = {
        ...previous,
        title: previous.title ?? String(event['name'] ?? 'Tool'),
        content,
        toolArgs: parseToolArgs(content) ?? previous.toolArgs,
      };
      changed = true;
    }
  } else if (type === 'tool.progress') {
    const id = String(event['toolCallId'] ?? '');
    const index = entries.findIndex((entry) => entry.toolCallId === id);
    if (index >= 0) {
      const previous = entries[index]!;
      if (previous.title === 'AgentSwarm') return current;
      const update = asRecord(event['update']);
      entries[index] = {
        ...previous,
        content: `${previous.content}\n${String(update['text'] ?? '')}`.trim(),
      };
      changed = true;
    }
  } else if (type === 'tool.result') {
    const id = String(event['toolCallId'] ?? '');
    const outputText =
      typeof event['output'] === 'string' ? event['output'] : pretty(event['output']);
    const isError = event['isError'] === true;
    const indices = findToolEntryIndices(entries, id);
    if (indices.length > 0) {
      for (const index of indices) {
        const previous = entries[index]!;
        if (previous.title === 'AgentSwarm') {
          entries[index] = finalizeAgentSwarmEntry(previous, outputText, isError);
        } else {
          entries[index] = {
            ...previous,
            content: `${previous.content}\n${outputText}`.trim(),
            toolArgs: previous.toolArgs,
            streaming: false,
            error: isError,
          };
        }
      }
      changed = true;
    } else {
      entries.push({
        id: `tool:${id || envelope.seq.toString()}`,
        kind: 'tool',
        title: String(event['name'] ?? '工具结果'),
        content: outputText,
        toolCallId: id,
        streaming: false,
        error: isError,
      });
      changed = true;
    }
  } else if (type === 'turn.ended') {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry?.streaming && entry.kind !== 'subagent') {
        entries[index] = { ...entry, streaming: false };
        changed = true;
      }
    }
  } else if (type === 'turn.step.completed' && options.debugMode === true) {
    const timing = formatStepDebugTimingFromEvent(event);
    if (timing !== undefined) {
      entries.push({
        id: `debug:${envelope.seq.toString()}`,
        kind: 'status',
        title: '排障计时',
        content: timing,
      });
      changed = true;
    }
  } else if (type === 'error') {
    entries.push({
      id: `error:${envelope.seq.toString()}`,
      kind: 'error',
      title: String(event['code'] ?? '错误'),
      content: String(event['message'] ?? 'Unknown error'),
    });
    changed = true;
  } else if (type.startsWith('subagent.')) {
    if (options.suppressForegroundSubagents !== false) {
      const subagentId = String(event['subagentId'] ?? '');
      const entryId = `subagent:${subagentId}`;
      const existing = entries.find((entry) => entry.id === entryId);
      if (type === 'subagent.spawned') {
        const runInBackground = event['runInBackground'] === true;
        const parentToolCallId = String(event['parentToolCallId'] ?? '');
        const parentIsSwarm =
          parentToolCallId.length > 0 &&
          entries.some(
            (entry) => entry.toolCallId === parentToolCallId && entry.title === 'AgentSwarm',
          );
        // Foreground AgentSwarm members render inside AgentSwarmProgress only.
        if (!runInBackground && (parentIsSwarm || parentToolCallId.length > 0)) {
          return current;
        }
      } else if (existing === undefined) {
        // Lifecycle follow-ups for suppressed foreground members — ignore.
        return current;
      }
    }
    updateSubagentEntry(entries, envelope.seq, event, type);
    changed = true;
  } else if (type === 'background.task.started' || type === 'background.task.terminated') {
    updateBackgroundTaskEntry(entries, envelope.seq, event, type);
    changed = true;
  } else if (type === 'skill.activated') {
    // Engineering-mode bootstrap is a silent preload — hide from the timeline.
    if (event['trigger'] === 'engineering-bootstrap') {
      return current;
    }
    entries.push({
      id: `skill:${String(event['activationId'] ?? envelope.seq)}`,
      kind: 'status',
      title: `Skill · ${String(event['skillName'] ?? 'unknown')}`,
      content: String(event['skillArgs'] ?? ''),
    });
    changed = true;
  } else if (type === 'plugin_command.activated') {
    entries.push({
      id: `plugin-command:${String(event['activationId'] ?? envelope.seq)}`,
      kind: 'status',
      title: `Plugin · ${String(event['pluginId'] ?? 'unknown')}:${String(event['commandName'] ?? 'unknown')}`,
      content: String(event['commandArgs'] ?? ''),
    });
    changed = true;
  } else if (type === 'cron.fired') {
    entries.push({
      id: `cron:${envelope.seq.toString()}`,
      kind: 'cron',
      title: '定时任务已触发',
      content: String(event['prompt'] ?? ''),
    });
    changed = true;
  } else if (type === 'hook.result' || type === 'warning' || type === 'compaction.completed') {
    entries.push({
      id: `status:${envelope.seq.toString()}`,
      kind: 'status',
      title: type,
      content: String(event['content'] ?? event['message'] ?? ''),
    });
    changed = true;
  }
  return changed ? entries : current;
}

export function appendSwarmMarker(
  current: readonly TimelineEntry[],
  state: SwarmMarkerState,
): readonly TimelineEntry[] {
  return [
    ...current,
    {
      id: `swarm-marker:${state}:${Date.now().toString()}`,
      kind: 'swarm-marker',
      swarmMarker: state,
      title: swarmMarkerTitle(state),
      content: '',
    },
  ];
}

export function swarmMarkerTitle(state: SwarmMarkerState): string {
  switch (state) {
    case 'active':
      return '集群模式已开启';
    case 'inactive':
      return '集群模式已关闭';
    case 'ended':
      return '集群任务已结束';
  }
}

function finalizeAgentSwarmEntry(
  previous: TimelineEntry,
  outputText: string,
  isError: boolean,
): TimelineEntry {
  const summary = agentSwarmResultSummaryFromOutput(outputText);
  if (summary.parsed) {
    return {
      ...previous,
      content: formatAgentSwarmSummaryLabel(summary),
      streaming: false,
      error: false,
    };
  }
  const aborted = isError && /\b(?:aborted|cancelled)\b/i.test(outputText);
  return {
    ...previous,
    content: isError ? formatAgentSwarmError(outputText) : outputText,
    streaming: false,
    error: isError && !aborted,
  };
}

function updateSubagentEntry(
  entries: TimelineEntry[],
  seq: number,
  event: Readonly<Record<string, unknown>>,
  type: string,
): void {
  const subagentId = String(event['subagentId'] ?? seq);
  const entryId = `subagent:${subagentId}`;
  const index = entries.findIndex((entry) => entry.id === entryId);
  const previous = index >= 0 ? entries[index] : undefined;
  const title = String(event['subagentName'] ?? previous?.title ?? `子 Agent ${subagentId}`);
  const description = String(event['description'] ?? '');
  const result = String(event['resultSummary'] ?? '');
  const error = String(event['error'] ?? '');
  const lifecycle = type.slice('subagent.'.length);
  const status = {
    spawned: event['runInBackground'] === true ? '后台运行' : '已创建',
    started: '运行中',
    suspended: `已挂起${event['reason'] === undefined ? '' : `：${String(event['reason'])}`}`,
    completed: '已完成',
    failed: '失败',
  }[lifecycle] ?? lifecycle;
  const previousDescription = previous?.content.split('\n')[0];
  const content = [description || previousDescription, status, result, error].filter(Boolean).join('\n');
  const next: TimelineEntry = {
    id: entryId,
    kind: 'subagent',
    title,
    content,
    streaming: lifecycle === 'spawned' || lifecycle === 'started',
    error: lifecycle === 'failed',
  };
  if (index >= 0) entries[index] = next;
  else entries.push(next);
}

function updateBackgroundTaskEntry(
  entries: TimelineEntry[],
  seq: number,
  event: Readonly<Record<string, unknown>>,
  type: string,
): void {
  const info = asRecord(event['info']);
  const taskId = String(info['taskId'] ?? seq);
  const agentId = typeof info['agentId'] === 'string' ? info['agentId'] : undefined;
  const entryId = info['kind'] === 'agent' && agentId !== undefined
    ? `subagent:${agentId}`
    : `background:${taskId}`;
  const index = entries.findIndex((entry) => entry.id === entryId);
  const previous = index >= 0 ? entries[index] : undefined;
  const kind = info['kind'] === 'agent' ? 'subagent' : 'status';
  const title = previous?.title ?? (info['kind'] === 'agent' ? '后台 Agent' : '后台任务');
  const status = String(info['status'] ?? (type.endsWith('started') ? 'running' : 'completed'));
  const next: TimelineEntry = {
    id: entryId,
    kind,
    title,
    content: [String(info['description'] ?? taskId), status, String(info['stopReason'] ?? '')]
      .filter(Boolean)
      .join('\n'),
    streaming: status === 'running',
    error: status === 'failed' || status === 'timed_out' || status === 'lost',
  };
  if (index >= 0) entries[index] = next;
  else entries.push(next);
}

export function replayTimeline(
  replay: readonly unknown[],
  liveEvents: readonly EventEnvelope[],
  options: ReduceLiveEventOptions = {},
): readonly TimelineEntry[] {
  let entries: TimelineEntry[] = [];
  let counter = 0;
  for (const rawRecord of replay) {
    const record = asRecord(rawRecord);
    if (record['type'] !== 'message') continue;
    const message = asRecord(record['message']);
    const role = String(message['role'] ?? '');
    const origin = asRecord(message['origin']);
    const originKind = typeof origin['kind'] === 'string' ? origin['kind'] : undefined;
    const content = contentText(message['content']);

    if (role === 'user') {
      if (originKind !== undefined && SKIP_REPLAY_ORIGINS.has(originKind)) continue;
      if (originKind === 'shell_command' && origin['phase'] !== 'input') continue;
      if (originKind === 'skill_activation' && origin['trigger'] !== 'user-slash') continue;
      if (originKind === 'plugin_command' && origin['trigger'] !== 'user-slash') continue;
      if (content.length > 0) {
        entries.push({ id: `replay:${counter++}`, kind: 'user', content });
      }
      continue;
    }

    if (role === 'assistant') {
      if (content.length > 0) {
        entries.push({ id: `replay:${counter++}`, kind: 'assistant', content });
      }
      const calls = Array.isArray(message['toolCalls']) ? message['toolCalls'] : [];
      for (const rawCall of calls) {
        const call = asRecord(rawCall);
        const fn = asRecord(call['function']);
        const toolName = String(fn['name'] ?? call['name'] ?? 'Tool');
        entries.push({
          id: `replay:${counter++}`,
          kind: 'tool',
          title: toolName,
          content: pretty(call),
          toolCallId: String(call['id'] ?? ''),
          toolArgs: parseToolArgs(fn['arguments'] ?? call['args']),
          streaming: false,
        });
      }
      continue;
    }

    if (role === 'tool') {
      const toolCallId = String(message['toolCallId'] ?? '');
      const index = entries.findIndex((entry) => entry.toolCallId === toolCallId && entry.kind === 'tool');
      const isError = message['isError'] === true;
      if (index >= 0) {
        const previous = entries[index]!;
        if (previous.title === 'AgentSwarm') {
          entries[index] = finalizeAgentSwarmEntry(previous, content, isError);
        } else {
          entries[index] = {
            ...previous,
            content: content.length > 0 ? content : previous.content,
            streaming: false,
            error: isError,
          };
        }
      } else {
        entries.push({
          id: `replay:${counter++}`,
          kind: 'tool',
          title: '工具结果',
          content,
          toolCallId,
          error: isError,
        });
      }
    }
  }
  for (const event of liveEvents) entries = [...reduceLiveEvent(entries, event, options)];
  return entries;
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .map((part) => {
      const item = asRecord(part);
      if (item['type'] === 'text') return String(item['text'] ?? '');
      if (item['type'] === 'image_url') return '[图片]';
      if (item['type'] === 'video_url') return '[视频]';
      return '';
    })
    .join('');
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function findToolEntryIndex(entries: readonly TimelineEntry[], toolCallId: string): number {
  if (toolCallId.length === 0) return -1;
  return entries.findIndex((entry) => entry.kind === 'tool' && entry.toolCallId === toolCallId);
}

function findToolEntryIndices(entries: readonly TimelineEntry[], toolCallId: string): number[] {
  if (toolCallId.length === 0) return [];
  return entries.flatMap((entry, index) =>
    entry.kind === 'tool' && entry.toolCallId === toolCallId ? [index] : [],
  );
}

function parseToolArgs(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function pretty(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
