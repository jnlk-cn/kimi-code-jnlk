import type { TokenUsage } from '@moonshot-ai/kimi-code-sdk';

import { FOOTER_TELEMETRY_SEPARATOR } from '#/tui/constant/footer-telemetry';
import { estimateStepCostCny, isDeepSeekPeakHour } from './deepseek-pricing';
import { formatTokenCount } from './usage-format';

export interface FooterTelemetry {
  readonly billingEnabled: boolean;
  readonly sessionInput: number;
  readonly sessionOutput: number;
  readonly sessionCacheHit: number;
  readonly sessionCacheMiss: number;
  readonly estimatedCostCny: number;
  readonly lastTurnCachePct: number | null;
  readonly balanceCny: string | null;
  readonly balanceGrantedCny: string | null;
  readonly balanceAvailable: boolean;
  readonly balanceFetchedAtMs: number | null;
}

export const EMPTY_FOOTER_TELEMETRY: FooterTelemetry = {
  billingEnabled: false,
  sessionInput: 0,
  sessionOutput: 0,
  sessionCacheHit: 0,
  sessionCacheMiss: 0,
  estimatedCostCny: 0,
  lastTurnCachePct: null,
  balanceCny: null,
  balanceGrantedCny: null,
  balanceAvailable: true,
  balanceFetchedAtMs: null,
};

export interface StepUsageSnapshot {
  readonly modelId: string;
  readonly hitTokens: number;
  readonly missTokens: number;
  readonly outputTokens: number;
  readonly occurredAtMs: number;
}

export function usageToStepSnapshot(
  modelId: string,
  usage: TokenUsage,
  occurredAtMs: number,
): StepUsageSnapshot {
  const hit = usage.inputCacheRead ?? 0;
  const miss = (usage.inputOther ?? 0) + (usage.inputCacheCreation ?? 0);
  return {
    modelId,
    hitTokens: hit,
    missTokens: miss,
    outputTokens: usage.output ?? 0,
    occurredAtMs,
  };
}

export function cacheHitPct(hit: number, miss: number): number | null {
  const total = hit + miss;
  if (total <= 0) return null;
  return Math.round((hit / total) * 100);
}

export function formatCny(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '¥0.00';
  if (amount >= 0.01) return `¥${amount.toFixed(2)}`;
  return `¥${amount.toFixed(4)}`;
}

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

export class FooterTelemetryAccumulator {
  private billingEnabled = false;
  private sessionInput = 0;
  private sessionOutput = 0;
  private sessionCacheHit = 0;
  private sessionCacheMiss = 0;
  private estimatedCostCny = 0;
  private lastTurnCachePct: number | null = null;
  private balanceCny: string | null = null;
  private balanceGrantedCny: string | null = null;
  private balanceAvailable = true;
  private balanceFetchedAtMs: number | null = null;

  setBillingEnabled(enabled: boolean): void {
    this.billingEnabled = enabled;
  }

  recordStep(snapshot: StepUsageSnapshot): void {
    this.sessionCacheHit += snapshot.hitTokens;
    this.sessionCacheMiss += snapshot.missTokens;
    this.sessionInput += snapshot.hitTokens + snapshot.missTokens;
    this.sessionOutput += snapshot.outputTokens;
    this.lastTurnCachePct = cacheHitPct(snapshot.hitTokens, snapshot.missTokens);
    if (this.billingEnabled) {
      this.estimatedCostCny += estimateStepCostCny({
        modelId: snapshot.modelId,
        hitTokens: snapshot.hitTokens,
        missTokens: snapshot.missTokens,
        outputTokens: snapshot.outputTokens,
        atMs: snapshot.occurredAtMs,
      });
    }
  }

  reconcileFromTotal(total: TokenUsage, billingEnabled: boolean): void {
    const hit = total.inputCacheRead ?? 0;
    const miss = (total.inputOther ?? 0) + (total.inputCacheCreation ?? 0);
    this.sessionCacheHit = hit;
    this.sessionCacheMiss = miss;
    this.sessionInput = hit + miss;
    this.sessionOutput = total.output ?? 0;
    this.lastTurnCachePct = cacheHitPct(hit, miss);
    this.billingEnabled = billingEnabled;
  }

  setEstimatedCostCny(cost: number): void {
    this.estimatedCostCny = cost;
  }

  setBalance(info: {
    totalCny: string;
    grantedCny: string;
    available: boolean;
    fetchedAtMs: number;
  }): void {
    this.balanceCny = info.totalCny;
    this.balanceGrantedCny = info.grantedCny;
    this.balanceAvailable = info.available;
    this.balanceFetchedAtMs = info.fetchedAtMs;
  }

  reset(): void {
    this.sessionInput = 0;
    this.sessionOutput = 0;
    this.sessionCacheHit = 0;
    this.sessionCacheMiss = 0;
    this.estimatedCostCny = 0;
    this.lastTurnCachePct = null;
  }

  snapshot(): FooterTelemetry {
    return {
      billingEnabled: this.billingEnabled,
      sessionInput: this.sessionInput,
      sessionOutput: this.sessionOutput,
      sessionCacheHit: this.sessionCacheHit,
      sessionCacheMiss: this.sessionCacheMiss,
      estimatedCostCny: this.estimatedCostCny,
      lastTurnCachePct: this.lastTurnCachePct,
      balanceCny: this.balanceCny,
      balanceGrantedCny: this.balanceGrantedCny,
      balanceAvailable: this.balanceAvailable,
      balanceFetchedAtMs: this.balanceFetchedAtMs,
    };
  }
}
