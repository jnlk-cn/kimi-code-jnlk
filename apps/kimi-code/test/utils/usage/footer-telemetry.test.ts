import { describe, expect, it } from 'vitest';

import {
  buildTelemetrySegments,
  cacheHitPct,
  FooterTelemetryAccumulator,
  formatCny,
  joinTelemetrySegments,
  usageToStepSnapshot,
} from '#/utils/usage/footer-telemetry';

describe('footer-telemetry', () => {
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

  it('builds telemetry segments with truncation priority', () => {
    const telemetry = {
      billingEnabled: true,
      sessionInput: 42_000,
      sessionOutput: 8_000,
      sessionCacheHit: 26_000,
      sessionCacheMiss: 16_000,
      estimatedCostCny: 0.18,
      lastTurnCachePct: 62,
      balanceCny: '12.38',
      balanceGrantedCny: null,
      balanceAvailable: true,
      balanceFetchedAtMs: Date.now(),
    };
    const offPeakMs = Date.UTC(2026, 6, 8, 14, 0, 0);
    const segments = buildTelemetrySegments(telemetry, offPeakMs);
    const full = joinTelemetrySegments(segments, 200);
    expect(full).toContain('缓存');
    expect(full).toContain('约');
    expect(full).toContain('余额');

    const narrow = joinTelemetrySegments(segments, 24);
    expect(narrow).toContain('缓存');
    expect(narrow).not.toContain('会话');
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
