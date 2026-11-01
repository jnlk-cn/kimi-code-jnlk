import type { AgentStatusUpdatedEvent, TurnStepCompletedEvent } from '@moonshot-ai/kimi-code-sdk';
import {
  DEEPSEEK_BALANCE_POLL_MS,
  estimateStepCostCny,
  FooterTelemetryAccumulator,
  isDeepSeekProvider,
  usageToStepSnapshot,
  wireModelId,
} from '@moonshot-ai/kimi-code-sdk';

import type { FooterComponent } from '#/tui/components/chrome/footer';
import type { AppState } from '#/tui/types';
import { loadDeepSeekBalance } from '#/utils/usage/deepseek-balance';

/**
 * Feeds the footer's billing line: session cache hit rate and token totals
 * from turn steps, the estimated DeepSeek spend priced at each step's
 * timestamp, and the account balance re-polled while a DeepSeek model is
 * active. Non-DeepSeek models only ever contribute the cache and token
 * segments.
 */
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
    this.accumulator.setBillingEnabled(this.isBillingEnabled());
    this.flushFooter();
  }

  dispose(): void {
    this.disposed = true;
    this.stopBalancePoll();
  }

  /** Re-evaluate the active model: gate billing segments, start or stop polling. */
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
    this.accumulator.setBillingEnabled(this.isBillingEnabled());
    this.accumulator.recordStep(
      usageToStepSnapshot(
        wireModelId(state.model, state.availableModels),
        event.usage,
        Date.now(),
      ),
    );
    this.flushFooter();
    this.onRefresh();
  }

  onStatusUpdate(event: AgentStatusUpdatedEvent): void {
    const total = event.usage?.total;
    if (total === undefined) return;
    const snapshot = this.accumulator.snapshot();
    if (snapshot.sessionInput > 0 || snapshot.sessionOutput > 0) return;

    const state = this.getAppState();
    const billing = this.isBillingEnabled();
    this.accumulator.reconcileFromTotal(total, billing);
    if (billing) {
      this.accumulator.setEstimatedCostCny(
        estimateStepCostCny({
          modelId: wireModelId(state.model, state.availableModels),
          hitTokens: total.inputCacheRead ?? 0,
          missTokens: (total.inputOther ?? 0) + (total.inputCacheCreation ?? 0),
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

  private flushFooter(): void {
    this.getFooter().setTelemetry(this.accumulator.snapshot());
  }

  private startBalancePoll(): void {
    this.stopBalancePoll();
    if (this.disposed || !this.isBillingEnabled()) return;
    this.pollTimer = setInterval(() => {
      void this.fetchBalanceOnce();
    }, DEEPSEEK_BALANCE_POLL_MS);
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
    const state = this.getAppState();
    this.balanceFetchInFlight = true;
    try {
      const result = await loadDeepSeekBalance(
        state.model,
        state.availableModels,
        state.availableProviders,
      );
      if (result?.balance === undefined || this.disposed) return;
      this.accumulator.setBalance({ ...result.balance, fetchedAtMs: Date.now() });
      this.flushFooter();
      this.onRefresh();
    } finally {
      this.balanceFetchInFlight = false;
    }
  }
}
