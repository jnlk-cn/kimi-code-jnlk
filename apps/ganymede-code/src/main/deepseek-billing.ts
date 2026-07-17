import {
  cacheHitPct,
  DEEPSEEK_PEAK_MULTIPLIER,
  estimateStepCostCny,
  fetchDeepSeekBalance,
  FooterTelemetryAccumulator,
  isDeepSeekPeakHour,
  isDeepSeekProvider,
  resolveDeepSeekProviderApiKey,
  resolveDeepSeekRates,
  usageToStepSnapshot,
  wireModelId,
  type Event,
  type KimiConfig,
  type TokenUsage,
} from '@moonshot-ai/kimi-code-sdk';

import type { DeepSeekBillingSnapshot, DeepSeekRateView } from '../shared/contracts';

export class DeepSeekBillingTracker {
  private readonly accumulator = new FooterTelemetryAccumulator();
  private toppedUpCny: string | null = null;
  private balanceError: string | undefined;
  private modelAlias: string | null = null;
  private wireModel: string | null = null;
  private apiKey: string | undefined;
  private baseUrl: string | undefined;
  private enabled = false;
  private balanceFetchInFlight = false;

  syncFromConfig(config: KimiConfig, model: string | undefined): void {
    this.modelAlias = model ?? null;
    if (model === undefined) {
      this.enabled = false;
      this.wireModel = null;
      this.apiKey = undefined;
      this.baseUrl = undefined;
      this.accumulator.setBillingEnabled(false);
      return;
    }

    const models = config.models ?? {};
    const providers = config.providers ?? {};
    this.enabled = isDeepSeekProvider(model, models, providers);
    this.wireModel = this.enabled ? wireModelId(model, models) : null;
    this.accumulator.setBillingEnabled(this.enabled);

    if (!this.enabled) {
      this.apiKey = undefined;
      this.baseUrl = undefined;
      return;
    }

    const alias = models[model];
    const provider = alias === undefined ? undefined : providers[alias.provider];
    this.apiKey = resolveDeepSeekProviderApiKey(provider);
    this.baseUrl = provider?.baseUrl;
  }

  onEvent(event: Event): void {
    if (!this.enabled) return;

    if (event.type === 'turn.step.completed') {
      if (event.usage === undefined || this.wireModel === null) return;
      this.accumulator.recordStep(
        usageToStepSnapshot(this.wireModel, event.usage, Date.now()),
      );
      return;
    }

    if (event.type === 'agent.status.updated') {
      if (typeof event.model === 'string' && event.model !== this.modelAlias) {
        // Model string on the event is the alias id; caller should re-sync config.
        this.modelAlias = event.model;
      }
      const total = event.usage?.total;
      if (total === undefined) return;
      this.seedFromUsage(total);
    }
  }

  seedFromUsage(total: TokenUsage, atMs: number = Date.now()): void {
    if (!this.enabled || this.wireModel === null) return;
    const snap = this.accumulator.snapshot();
    if (snap.sessionInput > 0 || snap.sessionOutput > 0) return;

    this.accumulator.reconcileFromTotal(total, true);
    const hit = total.inputCacheRead ?? 0;
    const miss = (total.inputOther ?? 0) + (total.inputCacheCreation ?? 0);
    this.accumulator.setEstimatedCostCny(
      estimateStepCostCny({
        modelId: this.wireModel,
        hitTokens: hit,
        missTokens: miss,
        outputTokens: total.output ?? 0,
        atMs,
      }),
    );
  }

  reset(): void {
    this.accumulator.reset();
    this.toppedUpCny = null;
    this.balanceError = undefined;
  }

  async fetchBalanceOnce(): Promise<void> {
    if (!this.enabled || this.balanceFetchInFlight) return;
    if (this.apiKey === undefined) {
      this.balanceError = '未配置 DeepSeek API Key';
      return;
    }

    this.balanceFetchInFlight = true;
    try {
      const result = await fetchDeepSeekBalance(this.apiKey, this.baseUrl);
      if (!result.ok) {
        this.balanceError = result.message;
        return;
      }
      this.balanceError = undefined;
      this.toppedUpCny = result.toppedUpCny;
      this.accumulator.setBalance({
        totalCny: result.totalCny,
        grantedCny: result.grantedCny,
        available: result.available,
        fetchedAtMs: Date.now(),
      });
    } finally {
      this.balanceFetchInFlight = false;
    }
  }

  snapshot(nowMs: number = Date.now()): DeepSeekBillingSnapshot {
    if (!this.enabled) {
      return {
        enabled: false,
        balanceCny: null,
        grantedCny: null,
        toppedUpCny: null,
        balanceAvailable: true,
        balanceFetchedAtMs: null,
        sessionInput: 0,
        sessionOutput: 0,
        sessionCacheHit: 0,
        sessionCacheMiss: 0,
        sessionCacheHitPct: null,
        estimatedCostCny: 0,
        isPeakNow: false,
        modelId: null,
        rates: null,
        peakRates: null,
        pricingSource: 'embedded',
      };
    }

    const tele = this.accumulator.snapshot();
    const rates = this.wireModel === null ? undefined : resolveDeepSeekRates(this.wireModel);
    const rateView = rates === undefined ? null : toRateView(rates);
    const peakView =
      rateView === null
        ? null
        : {
            hit: rateView.hit * DEEPSEEK_PEAK_MULTIPLIER,
            miss: rateView.miss * DEEPSEEK_PEAK_MULTIPLIER,
            out: rateView.out * DEEPSEEK_PEAK_MULTIPLIER,
          };

    return {
      enabled: true,
      balanceCny: tele.balanceCny,
      grantedCny: tele.balanceGrantedCny,
      toppedUpCny: this.toppedUpCny,
      balanceAvailable: tele.balanceAvailable,
      balanceError: this.balanceError,
      balanceFetchedAtMs: tele.balanceFetchedAtMs,
      sessionInput: tele.sessionInput,
      sessionOutput: tele.sessionOutput,
      sessionCacheHit: tele.sessionCacheHit,
      sessionCacheMiss: tele.sessionCacheMiss,
      sessionCacheHitPct: cacheHitPct(tele.sessionCacheHit, tele.sessionCacheMiss),
      estimatedCostCny: tele.estimatedCostCny,
      isPeakNow: isDeepSeekPeakHour(new Date(nowMs)),
      modelId: this.wireModel,
      rates: rateView,
      peakRates: peakView,
      pricingSource: 'embedded',
    };
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get currentModelAlias(): string | null {
    return this.modelAlias;
  }
}

function toRateView(rates: { hit: number; miss: number; out: number }): DeepSeekRateView {
  return { hit: rates.hit, miss: rates.miss, out: rates.out };
}
