import type { EventEnvelope } from '../shared/contracts';

export type TimelineKind =
  | 'user'
  | 'assistant'
  | 'thinking'
  | 'tool'
  | 'status'
  | 'error'
  | 'cron'
  | 'subagent';

export interface TimelineEntry {
  readonly id: string;
  readonly kind: TimelineKind;
  readonly title?: string;
  readonly content: string;
  readonly toolCallId?: string;
  readonly streaming?: boolean;
  readonly error?: boolean;
}

export interface ReduceLiveEventOptions {
  readonly debugMode?: boolean;
}

export function reduceLiveEvent(
  current: readonly TimelineEntry[],
  envelope: EventEnvelope,
  options: ReduceLiveEventOptions = {},
): readonly TimelineEntry[] {
  const event = envelope.event;
  const type = String(event['type'] ?? '');
  const entries = [...current];
  if (type === 'assistant.delta') {
    const delta = String(event['delta'] ?? '');
    const last = entries.at(-1);
    if (last?.kind === 'assistant' && last.streaming === true) {
      entries[entries.length - 1] = { ...last, content: last.content + delta };
    } else {
      entries.push({
        id: `assistant:${envelope.seq.toString()}`,
        kind: 'assistant',
        content: delta,
        streaming: true,
      });
    }
  } else if (type === 'thinking.delta') {
    const delta = String(event['delta'] ?? '');
    const last = entries.at(-1);
    if (last?.kind === 'thinking' && last.streaming === true) {
      entries[entries.length - 1] = { ...last, content: last.content + delta };
    } else if (delta.length > 0) {
      entries.push({
        id: `thinking:${envelope.seq.toString()}`,
        kind: 'thinking',
        content: delta,
        streaming: true,
      });
    }
  } else if (type === 'tool.call.started') {
    entries.push({
      id: `tool:${String(event['toolCallId'] ?? envelope.seq)}`,
      kind: 'tool',
      title: String(event['name'] ?? 'Tool'),
      content: pretty(event['args']),
      toolCallId: String(event['toolCallId'] ?? ''),
      streaming: true,
    });
  } else if (type === 'tool.call.delta') {
    const id = String(event['toolCallId'] ?? '');
    const index = entries.findIndex((entry) => entry.toolCallId === id);
    const argumentsPart = String(event['argumentsPart'] ?? '');
    if (index >= 0 && argumentsPart.length > 0) {
      const previous = entries[index]!;
      entries[index] = {
        ...previous,
        title: previous.title ?? String(event['name'] ?? 'Tool'),
        content: previous.content + argumentsPart,
      };
    }
  } else if (type === 'tool.progress') {
    const id = String(event['toolCallId'] ?? '');
    const index = entries.findIndex((entry) => entry.toolCallId === id);
    if (index >= 0) {
      const previous = entries[index]!;
      const update = asRecord(event['update']);
      entries[index] = {
        ...previous,
        content: `${previous.content}\n${String(update['text'] ?? '')}`.trim(),
      };
    }
  } else if (type === 'tool.result') {
    const id = String(event['toolCallId'] ?? '');
    const index = entries.findIndex((entry) => entry.toolCallId === id);
    if (index >= 0) {
      const previous = entries[index]!;
      entries[index] = {
        ...previous,
        content: `${previous.content}\n${pretty(event['output'])}`.trim(),
        streaming: false,
        error: event['isError'] === true,
      };
    } else {
      entries.push({
        id: `tool:${id || envelope.seq.toString()}`,
        kind: 'tool',
        title: String(event['name'] ?? '工具结果'),
        content: pretty(event['output']),
        toolCallId: id,
        streaming: false,
        error: event['isError'] === true,
      });
    }
  } else if (type === 'turn.ended') {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry?.streaming && entry.kind !== 'subagent') {
        entries[index] = { ...entry, streaming: false };
      }
    }
  } else if (type === 'turn.step.completed' && options.debugMode === true) {
    const timing = formatStepDebugTiming(event);
    if (timing !== undefined) {
      entries.push({
        id: `debug:${envelope.seq.toString()}`,
        kind: 'status',
        title: '排障计时',
        content: timing,
      });
    }
  } else if (type === 'error') {
    entries.push({
      id: `error:${envelope.seq.toString()}`,
      kind: 'error',
      title: String(event['code'] ?? '错误'),
      content: String(event['message'] ?? 'Unknown error'),
    });
  } else if (type.startsWith('subagent.')) {
    updateSubagentEntry(entries, envelope.seq, event, type);
  } else if (type === 'background.task.started' || type === 'background.task.terminated') {
    updateBackgroundTaskEntry(entries, envelope.seq, event, type);
  } else if (type === 'skill.activated') {
    entries.push({
      id: `skill:${String(event['activationId'] ?? envelope.seq)}`,
      kind: 'status',
      title: `Skill · ${String(event['skillName'] ?? 'unknown')}`,
      content: String(event['skillArgs'] ?? ''),
    });
  } else if (type === 'plugin_command.activated') {
    entries.push({
      id: `plugin-command:${String(event['activationId'] ?? envelope.seq)}`,
      kind: 'status',
      title: `Plugin · ${String(event['pluginId'] ?? 'unknown')}:${String(event['commandName'] ?? 'unknown')}`,
      content: String(event['commandArgs'] ?? ''),
    });
  } else if (type === 'cron.fired') {
    entries.push({
      id: `cron:${envelope.seq.toString()}`,
      kind: 'cron',
      title: '定时任务已触发',
      content: String(event['prompt'] ?? ''),
    });
  } else if (type === 'hook.result' || type === 'warning' || type === 'compaction.completed') {
    entries.push({
      id: `status:${envelope.seq.toString()}`,
      kind: 'status',
      title: type,
      content: String(event['content'] ?? event['message'] ?? ''),
    });
  }
  return entries;
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
    const content = contentText(message['content']);
    if (role === 'user' && content.length > 0) {
      entries.push({ id: `replay:${counter++}`, kind: 'user', content });
    }
    if (role === 'assistant') {
      if (content.length > 0) {
        entries.push({ id: `replay:${counter++}`, kind: 'assistant', content });
      }
      const calls = Array.isArray(message['toolCalls']) ? message['toolCalls'] : [];
      for (const rawCall of calls) {
        const call = asRecord(rawCall);
        entries.push({
          id: `replay:${counter++}`,
          kind: 'tool',
          title: String(
            call['function'] ? asRecord(call['function'])['name'] : call['name'] ?? 'Tool',
          ),
          content: pretty(call),
          toolCallId: String(call['id'] ?? ''),
          streaming: false,
        });
      }
    }
    if (role === 'tool') {
      entries.push({
        id: `replay:${counter++}`,
        kind: 'tool',
        title: '工具结果',
        content,
        toolCallId: String(message['toolCallId'] ?? ''),
        error: message['isError'] === true,
      });
    }
  }
  for (const event of liveEvents) entries = [...reduceLiveEvent(entries, event, options)];
  return entries;
}

/** Minimal TTFT / stream timing line when both fields are present. */
export function formatStepDebugTiming(event: Readonly<Record<string, unknown>>): string | undefined {
  const latency = event['llmFirstTokenLatencyMs'];
  const streamMs = event['llmStreamDurationMs'];
  if (typeof latency !== 'number' || typeof streamMs !== 'number') return undefined;
  const parts = [`TTFT: ${formatDuration(latency)}`, `stream: ${formatDuration(streamMs)}`];
  const usage = asRecord(event['usage']);
  const output = usage['output'];
  if (typeof output === 'number' && output > 0 && streamMs >= 50) {
    parts.push(`TPS: ${(output / (streamMs / 1000)).toFixed(1)} tok/s`);
  }
  return `[Debug] ${parts.join(' | ')}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
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

function pretty(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
