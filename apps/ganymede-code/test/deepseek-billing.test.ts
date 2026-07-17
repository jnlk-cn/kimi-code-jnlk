import { describe, expect, it } from 'vitest';

import type { Event, KimiConfig } from '@moonshot-ai/kimi-code-sdk';

import { DeepSeekBillingTracker } from '../src/main/deepseek-billing';

const deepSeekConfig: KimiConfig = {
  providers: {
    deepseek: {
      type: 'openai',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
    },
  },
  models: {
    ds: {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      maxContextSize: 1_000_000,
    },
  },
};

const kimiConfig: KimiConfig = {
  providers: {
    kimi: {
      type: 'kimi',
      baseUrl: 'https://api.kimi.com/coding/v1',
    },
  },
  models: {
    k2: {
      provider: 'kimi',
      model: 'kimi-k2',
      maxContextSize: 1_000_000,
    },
  },
};

describe('DeepSeekBillingTracker', () => {
  it('disables billing for non-DeepSeek providers', () => {
    const tracker = new DeepSeekBillingTracker();
    tracker.syncFromConfig(kimiConfig, 'k2');
    expect(tracker.isEnabled).toBe(false);
    expect(tracker.snapshot().enabled).toBe(false);
  });

  it('accumulates step cost with peak multiplier', () => {
    const tracker = new DeepSeekBillingTracker();
    tracker.syncFromConfig(deepSeekConfig, 'ds');
    expect(tracker.isEnabled).toBe(true);

    const offPeakMs = Date.UTC(2026, 6, 8, 14, 0, 0);
    const event = {
      type: 'turn.step.completed',
      turnId: 0,
      step: 1,
      stepId: 'step-1',
      usage: {
        inputOther: 0,
        inputCacheRead: 1_000_000,
        inputCacheCreation: 0,
        output: 0,
      },
      finishReason: 'end_turn',
    } as Event;

    // Override Date.now for cost accumulation path inside onEvent.
    const realNow = Date.now;
    Date.now = () => offPeakMs;
    try {
      tracker.onEvent(event);
    } finally {
      Date.now = realNow;
    }

    const snap = tracker.snapshot(offPeakMs);
    expect(snap.enabled).toBe(true);
    expect(snap.sessionInput).toBe(1_000_000);
    expect(snap.sessionCacheHit).toBe(1_000_000);
    expect(snap.sessionCacheMiss).toBe(0);
    expect(snap.estimatedCostCny).toBeCloseTo(0.02, 6);
    expect(snap.rates).toEqual({ hit: 0.02, miss: 1.0, out: 2.0 });
    expect(snap.peakRates).toEqual({ hit: 0.04, miss: 2.0, out: 4.0 });
    expect(snap.isPeakNow).toBe(false);

    const peakMs = Date.UTC(2026, 6, 8, 2, 0, 0);
    expect(tracker.snapshot(peakMs).isPeakNow).toBe(true);
  });

  it('seeds session usage totals when accumulator is empty', () => {
    const tracker = new DeepSeekBillingTracker();
    tracker.syncFromConfig(deepSeekConfig, 'ds');

    const offPeakMs = Date.UTC(2026, 6, 8, 14, 0, 0);
    tracker.seedFromUsage(
      {
        inputOther: 200,
        inputCacheRead: 800,
        inputCacheCreation: 0,
        output: 120,
      },
      offPeakMs,
    );

    const snap = tracker.snapshot(offPeakMs);
    expect(snap.sessionInput).toBe(1000);
    expect(snap.sessionOutput).toBe(120);
    expect(snap.sessionCacheHit).toBe(800);
    expect(snap.sessionCacheMiss).toBe(200);
    expect(snap.sessionCacheHitPct).toBe(80);
    expect(snap.estimatedCostCny).toBeGreaterThan(0);
  });

  it('does not overwrite accumulated step usage when seeding', () => {
    const tracker = new DeepSeekBillingTracker();
    tracker.syncFromConfig(deepSeekConfig, 'ds');
    const offPeakMs = Date.UTC(2026, 6, 8, 14, 0, 0);
    tracker.onEvent({
      type: 'turn.step.completed',
      turnId: 0,
      step: 1,
      stepId: 'step-1',
      usage: {
        inputOther: 0,
        inputCacheRead: 500,
        inputCacheCreation: 0,
        output: 10,
      },
      finishReason: 'end_turn',
    } as Event);

    tracker.seedFromUsage(
      {
        inputOther: 9_999,
        inputCacheRead: 9_999,
        inputCacheCreation: 0,
        output: 9_999,
      },
      offPeakMs,
    );

    const snap = tracker.snapshot(offPeakMs);
    expect(snap.sessionInput).toBe(500);
    expect(snap.sessionOutput).toBe(10);
  });

  it('stores balance from fetchDeepSeekBalance', async () => {
    const tracker = new DeepSeekBillingTracker();
    tracker.syncFromConfig(deepSeekConfig, 'ds');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          is_available: true,
          balance_infos: [
            {
              currency: 'CNY',
              total_balance: '9.50',
              granted_balance: '0.50',
              topped_up_balance: '9.00',
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      await tracker.fetchBalanceOnce();
    } finally {
      globalThis.fetch = originalFetch;
    }

    const snap = tracker.snapshot();
    expect(snap.balanceCny).toBe('9.50');
    expect(snap.grantedCny).toBe('0.50');
    expect(snap.toppedUpCny).toBe('9.00');
    expect(snap.balanceAvailable).toBe(true);
  });
});
