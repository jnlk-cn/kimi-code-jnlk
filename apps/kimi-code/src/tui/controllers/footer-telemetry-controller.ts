import type { AgentStatusUpdatedEvent, ProviderConfig, TurnStepCompletedEvent } from '@moonshot-ai/kimi-code-sdk';

import type { FooterComponent } from '#/tui/components/chrome/footer';
import { FOOTER_BALANCE_POLL_MS } from '#/tui/constant/footer-telemetry';
import type { AppState } from '#/tui/types';
import { fetchDeepSeekBalance } from '#/utils/usage/deepseek-balance';
import {
  estimateStepCostCny,
  isDeepSeekProvider,
  wireModelId,
} from '#/utils/usage/deepseek-pricing';
import { FooterTelemetryAccumulator, usageToStepSnapshot } from '#/utils/usage/footer-telemetry';

function resolveProviderApiKey(provider: ProviderConfig | undefined): string | undefined {
  if (provider === undefined) return undefined;
  if (provider.apiKey !== undefined && provider.apiKey.trim().length > 0) {
    return provider.apiKey.trim();
  }
  const env = provider.env;
  if (env === undefined) return undefined;
  for (const key of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY']) {
    const value = env[key]?.trim();
    if (value !== undefined && value.length > 0) return value;
  }
  return undefined;
}

export class FooterTelemetryController {
  private readonly accumulator = new FooterTelemetryAccumulator();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private balanceFetchInFlight = false;
  private disposed = false;

  constructor(
    private readonly getFooter: () => FooterComponent,
    private readonly getAppState: () => AppState,
    private readonly onRefresh: () => void,
  ) {
    this.flushFooter();
  }

  reset(): void {
    this.accumulator.reset();
    this.flushFooter();
    this.syncProviderContext();
  }

  dispose(): void {
    this.disposed = true;
    this.stopBalancePoll();
  }

  syncProviderContext(): void {
    const billing = this.isBillingEnabled();
    this.accumulator.setBillingEnabled(billing);
    this.flushFooter();
    if (billing) {
      void this.fetchBalanceOnce();
      this.startBalancePoll();
    } else {
      this.stopBalancePoll();
    }
  }

  onStepCompleted(event: TurnStepCompletedEvent): void {
    if (event.usage === undefined) return;
    const state = this.getAppState();
    const billing = this.isBillingEnabled();
    this.accumulator.setBillingEnabled(billing);
    const modelId = wireModelId(state.model, state.availableModels);
    this.accumulator.recordStep(
      usageToStepSnapshot(modelId, event.usage, Date.now()),
    );
    this.flushFooter();
    this.onRefresh();
  }

  onStatusUpdate(event: AgentStatusUpdatedEvent): void {
    const total = event.usage?.total;
    if (total === undefined) return;
    const snap = this.accumulator.snapshot();
    if (snap.sessionInput > 0 || snap.sessionOutput > 0) return;

    const state = this.getAppState();
    const billing = this.isBillingEnabled();
    this.accumulator.reconcileFromTotal(total, billing);
    if (billing) {
      const hit = total.inputCacheRead ?? 0;
      const miss = (total.inputOther ?? 0) + (total.inputCacheCreation ?? 0);
      const modelId = wireModelId(state.model, state.availableModels);
      this.accumulator.setEstimatedCostCny(
        estimateStepCostCny({
          modelId,
          hitTokens: hit,
          missTokens: miss,
          outputTokens: total.output ?? 0,
          atMs: Date.now(),
        }),
      );
    }
    this.flushFooter();
    this.onRefresh();
  }

  private isBillingEnabled(): boolean {
    const state = this.getAppState();
    return isDeepSeekProvider(state.model, state.availableModels, state.availableProviders);
  }

  private deepSeekProviderConfig(): ProviderConfig | undefined {
    const state = this.getAppState();
    const alias = state.availableModels[state.model];
    if (alias === undefined) return undefined;
    return state.availableProviders[alias.provider];
  }

  private flushFooter(): void {
    this.getFooter().setTelemetry(this.accumulator.snapshot());
  }

  private startBalancePoll(): void {
    this.stopBalancePoll();
    if (this.disposed || !this.isBillingEnabled()) return;
    this.pollTimer = setInterval(() => {
      void this.fetchBalanceOnce();
    }, FOOTER_BALANCE_POLL_MS);
    this.pollTimer.unref?.();
  }

  private stopBalancePoll(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async fetchBalanceOnce(): Promise<void> {
    if (this.disposed || this.balanceFetchInFlight || !this.isBillingEnabled()) return;
    const provider = this.deepSeekProviderConfig();
    const apiKey = resolveProviderApiKey(provider);
    if (apiKey === undefined) return;

    this.balanceFetchInFlight = true;
    try {
      const result = await fetchDeepSeekBalance(apiKey, provider?.baseUrl);
      if (!result.ok || this.disposed) return;
      this.accumulator.setBalance({
        totalCny: result.totalCny,
        grantedCny: result.grantedCny,
        available: result.available,
        fetchedAtMs: Date.now(),
      });
      this.flushFooter();
      this.onRefresh();
    } finally {
      this.balanceFetchInFlight = false;
    }
  }
}
