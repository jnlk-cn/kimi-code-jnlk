import {
  cacheHitPct,
  formatCny,
  isDeepSeekPeakHour,
  type FooterTelemetry,
} from '@moonshot-ai/kimi-code-sdk';

import { FOOTER_TELEMETRY_SEPARATOR } from '#/tui/constant/footer-telemetry';
import { formatTokenCount } from './usage-format';

export {
  cacheHitPct,
  EMPTY_FOOTER_TELEMETRY,
  FooterTelemetryAccumulator,
  formatCny,
  usageToStepSnapshot,
  type FooterTelemetry,
  type StepUsageSnapshot,
} from '@moonshot-ai/kimi-code-sdk';

export interface FooterTelemetrySegment {
  readonly text: string;
  readonly priority: number;
}

export function buildTelemetrySegments(
  telemetry: FooterTelemetry,
  nowMs: number = Date.now(),
): readonly FooterTelemetrySegment[] {
  const segments: FooterTelemetrySegment[] = [];
  const sessionInput = telemetry.sessionInput;
  const sessionOutput = telemetry.sessionOutput;
  const hasTokens = sessionInput > 0 || sessionOutput > 0;

  const sessionCachePct = cacheHitPct(telemetry.sessionCacheHit, telemetry.sessionCacheMiss);
  if (sessionCachePct !== null) {
    segments.push({ text: `缓存 ${sessionCachePct}%`, priority: 0 });
  }

  if (telemetry.billingEnabled && telemetry.estimatedCostCny > 0) {
    const peak = isDeepSeekPeakHour(new Date(nowMs));
    segments.push({
      text: peak ? `约 ${formatCny(telemetry.estimatedCostCny)}(高峰)` : `约 ${formatCny(telemetry.estimatedCostCny)}`,
      priority: 1,
    });
  } else if (telemetry.billingEnabled && isDeepSeekPeakHour(new Date(nowMs))) {
    segments.push({ text: '高峰', priority: 2 });
  }

  if (telemetry.billingEnabled && telemetry.balanceCny !== null) {
    if (telemetry.balanceAvailable) {
      segments.push({ text: `余额 ${formatBalanceCny(telemetry.balanceCny)}`, priority: 3 });
    } else {
      segments.push({ text: '余额不足', priority: 3 });
    }
  }

  if (hasTokens) {
    segments.push({
      text: `会话 ${formatTokenCount(sessionInput)}入/${formatTokenCount(sessionOutput)}出`,
      priority: 4,
    });
  }

  return segments;
}

function formatBalanceCny(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('¥')) return trimmed;
  return `¥${trimmed}`;
}

export function joinTelemetrySegments(
  segments: readonly FooterTelemetrySegment[],
  maxWidth: number,
): string {
  if (maxWidth <= 0 || segments.length === 0) return '';
  const ordered = [...segments].sort((a, b) => a.priority - b.priority);
  let included = ordered.map((s) => s.text);
  while (included.length > 0) {
    const line = included.join(FOOTER_TELEMETRY_SEPARATOR);
    if (line.length <= maxWidth) return line;
    included = included.slice(0, -1);
  }
  return ordered[0]?.text ?? '';
}
