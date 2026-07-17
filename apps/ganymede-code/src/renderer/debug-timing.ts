/**
 * Format LLM step timing for Debug / 排障 mode timeline rows.
 * Adapted from the Kimi CLI debug-timing helper so Ganymede shows TTFT
 * splits, decode TPS, and cache stats when the provider reports them.
 */

interface DebugTokenUsage {
  readonly inputOther?: number;
  readonly inputCacheRead?: number;
  readonly inputCacheCreation?: number;
  readonly output?: number;
}

export interface StepTimingInput {
  readonly llmFirstTokenLatencyMs?: number;
  readonly llmStreamDurationMs?: number;
  readonly llmRequestBuildMs?: number;
  readonly llmServerFirstTokenMs?: number;
  readonly llmServerDecodeMs?: number;
  readonly llmClientConsumeMs?: number;
  readonly usage?: DebugTokenUsage;
}

const MIN_STREAM_MS_FOR_TPS = 50;

export function parseStepTimingInput(
  event: Readonly<Record<string, unknown>>,
): StepTimingInput {
  const usageRaw = asRecord(event['usage']);
  const usage =
    usageRaw === undefined
      ? undefined
      : {
          inputOther: optionalNumber(usageRaw['inputOther']),
          inputCacheRead: optionalNumber(usageRaw['inputCacheRead']),
          inputCacheCreation: optionalNumber(usageRaw['inputCacheCreation']),
          output: optionalNumber(usageRaw['output']),
        };
  return {
    llmFirstTokenLatencyMs: optionalNumber(event['llmFirstTokenLatencyMs']),
    llmStreamDurationMs: optionalNumber(event['llmStreamDurationMs']),
    llmRequestBuildMs: optionalNumber(event['llmRequestBuildMs']),
    llmServerFirstTokenMs: optionalNumber(event['llmServerFirstTokenMs']),
    llmServerDecodeMs: optionalNumber(event['llmServerDecodeMs']),
    llmClientConsumeMs: optionalNumber(event['llmClientConsumeMs']),
    usage,
  };
}

export function formatStepDebugTiming(input: StepTimingInput): string | undefined {
  const latency = input.llmFirstTokenLatencyMs;
  const streamMs = input.llmStreamDurationMs;
  if (latency === undefined || streamMs === undefined) return undefined;

  const parts: string[] = [`TTFT: ${formatTtft(input)}`];
  const outputTokens = input.usage?.output;
  if (outputTokens !== undefined && outputTokens > 0) {
    if (streamMs >= MIN_STREAM_MS_FOR_TPS) {
      const tps = (outputTokens / (streamMs / 1000)).toFixed(1);
      parts.push(
        `TPS: ${tps} tok/s (${outputTokens} tokens in ${formatDuration(streamMs)}${formatDecodeSplit(input)})`,
      );
    } else {
      parts.push(
        `${outputTokens} tokens in ${formatDuration(streamMs)} (stream too short for TPS)`,
      );
    }
  } else {
    parts.push(`stream: ${formatDuration(streamMs)}`);
  }

  const inputTokens = usageInputTotal(input.usage);
  const hasInputUsage =
    input.usage !== undefined &&
    (input.usage.inputOther !== undefined ||
      input.usage.inputCacheRead !== undefined ||
      input.usage.inputCacheCreation !== undefined);
  if (hasInputUsage && (inputTokens > 0 || (outputTokens ?? 0) > 0)) {
    const cacheReadTokens = input.usage.inputCacheRead ?? 0;
    const cacheCreationTokens = input.usage.inputCacheCreation ?? 0;
    const cacheHitRate = inputTokens > 0 ? Math.round((cacheReadTokens / inputTokens) * 100) : 0;
    const cacheParts = [`cache read ${formatTokenCount(cacheReadTokens)} (${String(cacheHitRate)}%)`];
    if (cacheCreationTokens > 0) {
      cacheParts.push(`write ${formatTokenCount(cacheCreationTokens)}`);
    }
    parts.push(`tokens in ${formatTokenCount(inputTokens)}`);
    parts.push(cacheParts.join(' / '));
  }

  return `[Debug] ${parts.join(' | ')}`;
}

/** Convenience for timeline event payloads. */
export function formatStepDebugTimingFromEvent(
  event: Readonly<Record<string, unknown>>,
): string | undefined {
  return formatStepDebugTiming(parseStepTimingInput(event));
}

function usageInputTotal(usage: DebugTokenUsage | undefined): number {
  if (usage === undefined) return 0;
  return (usage.inputOther ?? 0) + (usage.inputCacheRead ?? 0) + (usage.inputCacheCreation ?? 0);
}

function formatTtft(input: StepTimingInput): string {
  const total = formatDuration(input.llmFirstTokenLatencyMs ?? 0);
  const build = input.llmRequestBuildMs;
  const server = input.llmServerFirstTokenMs;
  if (build === undefined || server === undefined) return total;
  return `${total} (api ${formatDuration(server)} + client ${formatDuration(build)})`;
}

function formatDecodeSplit(input: StepTimingInput): string {
  const server = input.llmServerDecodeMs;
  const client = input.llmClientConsumeMs;
  if (server === undefined || client === undefined) return '';
  return `; server ${formatDuration(server)} + client ${formatDuration(client)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
