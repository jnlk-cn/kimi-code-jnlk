import { estimateStepCostCny } from '#/deepseek/pricing';
import type { TokenUsage } from '#/types';

export { cacheHitPct, formatCny, type FooterTelemetry } from './format';
import { cacheHitPct, type FooterTelemetry } from './format';

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
