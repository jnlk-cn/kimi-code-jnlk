import {
  cacheHitPct,
  formatCny,
  isDeepSeekPeakHour,
  type FooterTelemetry,
} from '@moonshot-ai/kimi-code-sdk/deepseek/format';

import type { DeepSeekBillingSnapshot } from '../shared/contracts';

export const FOOTER_TELEMETRY_SEPARATOR = ' · ';
export const FOOTER_LOW_BALANCE_CNY = 1;

export interface FooterTelemetrySegment {
  readonly text: string;
  readonly priority: number;
  readonly tone: 'normal' | 'peak' | 'balance-warn' | 'balance-error';
}

export function billingSnapshotToTelemetry(snapshot: DeepSeekBillingSnapshot): FooterTelemetry {
  return {
    billingEnabled: snapshot.enabled,
    sessionInput: snapshot.sessionInput,
    sessionOutput: snapshot.sessionOutput,
    sessionCacheHit: snapshot.sessionCacheHit,
    sessionCacheMiss: snapshot.sessionCacheMiss,
    estimatedCostCny: snapshot.estimatedCostCny,
    lastTurnCachePct: snapshot.sessionCacheHitPct,
    balanceCny: snapshot.balanceCny,
    balanceGrantedCny: snapshot.grantedCny,
    balanceAvailable: snapshot.balanceAvailable,
    balanceFetchedAtMs: snapshot.balanceFetchedAtMs,
  };
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
    segments.push({ text: `缓存 ${sessionCachePct}%`, priority: 0, tone: 'normal' });
  }

  if (telemetry.billingEnabled && telemetry.estimatedCostCny > 0) {
    const peak = isDeepSeekPeakHour(new Date(nowMs));
    segments.push({
      text: peak
        ? `约 ${formatCny(telemetry.estimatedCostCny)}(高峰)`
        : `约 ${formatCny(telemetry.estimatedCostCny)}`,
      priority: 1,
      tone: peak ? 'peak' : 'normal',
    });
  } else if (telemetry.billingEnabled && isDeepSeekPeakHour(new Date(nowMs))) {
    segments.push({ text: '高峰', priority: 2, tone: 'peak' });
  }

  if (telemetry.billingEnabled && telemetry.balanceCny !== null) {
    if (telemetry.balanceAvailable) {
      const balanceLabel = `余额 ${formatBalanceCny(telemetry.balanceCny)}`;
      const balanceNum = Number.parseFloat(telemetry.balanceCny);
      const tone =
        Number.isFinite(balanceNum) && balanceNum < FOOTER_LOW_BALANCE_CNY
          ? 'balance-warn'
          : 'normal';
      segments.push({ text: balanceLabel, priority: 3, tone });
    } else {
      segments.push({ text: '余额不足', priority: 3, tone: 'balance-error' });
    }
  }

  if (hasTokens) {
    segments.push({
      text: `会话 ${formatFooterTokenCount(sessionInput)}入/${formatFooterTokenCount(sessionOutput)}出`,
      priority: 4,
      tone: 'normal',
    });
  }

  return segments;
}

export function joinTelemetrySegments(
  segments: readonly FooterTelemetrySegment[],
  maxWidth: number,
): readonly FooterTelemetrySegment[] {
  if (maxWidth <= 0 || segments.length === 0) return [];
  const ordered = [...segments].sort((a, b) => a.priority - b.priority);
  let included = ordered;
  while (included.length > 0) {
    const line = included.map((segment) => segment.text).join(FOOTER_TELEMETRY_SEPARATOR);
    if (line.length <= maxWidth) return included;
    included = included.slice(0, -1);
  }
  return ordered[0] === undefined ? [] : [ordered[0]];
}

function formatBalanceCny(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('¥')) return trimmed;
  return `¥${trimmed}`;
}

function formatFooterTokenCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
