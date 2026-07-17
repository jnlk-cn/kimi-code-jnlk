import { describe, expect, it } from 'vitest';

import {
  cacheHitPct,
  FooterTelemetryAccumulator,
  formatCny,
  usageToStepSnapshot,
} from '../src/deepseek/telemetry';

describe('deepseek-telemetry', () => {
  it('formats CNY amounts', () => {
    expect(formatCny(0)).toBe('¥0.00');
    expect(formatCny(0.052)).toBe('¥0.05');
    expect(formatCny(0.0023)).toBe('¥0.0023');
  });

  it('accumulates session usage and cost', () => {
    const acc = new FooterTelemetryAccumulator();
    acc.setBillingEnabled(true);
    const offPeakMs = Date.UTC(2026, 6, 8, 14, 0, 0);
    acc.recordStep({
      modelId: 'deepseek-v4-flash',
      hitTokens: 900,
      missTokens: 100,
      outputTokens: 50,
      occurredAtMs: offPeakMs,
    });

    const snap = acc.snapshot();
    expect(snap.sessionInput).toBe(1000);
    expect(snap.sessionOutput).toBe(50);
    expect(snap.sessionCacheHit).toBe(900);
    expect(cacheHitPct(snap.sessionCacheHit, snap.sessionCacheMiss)).toBe(90);
    expect(snap.estimatedCostCny).toBeGreaterThan(0);
  });

  it('maps TokenUsage to step snapshot', () => {
    const snapshot = usageToStepSnapshot(
      'deepseek-v4-flash',
      {
        inputOther: 100,
        inputCacheRead: 900,
        inputCacheCreation: 0,
        output: 50,
      },
      Date.now(),
    );
    expect(snapshot.hitTokens).toBe(900);
    expect(snapshot.missTokens).toBe(100);
    expect(snapshot.outputTokens).toBe(50);
  });
});
