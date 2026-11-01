import { describe, expect, it } from 'vitest';

import { EMPTY_FOOTER_TELEMETRY, type FooterTelemetry } from '@moonshot-ai/kimi-code-sdk';

import { darkColors } from '#/tui/theme';
import { buildTelemetrySegments, joinTelemetrySegments } from '#/utils/usage/footer-telemetry';

const stripAnsi = (text: string): string => text.replaceAll(/\u001B\[[0-9;]*m/g, '');

/** Beijing 10:00 — inside DeepSeek's peak window. */
const PEAK_MS = Date.UTC(2026, 0, 5, 2, 0, 0);
/** Beijing 00:00 — off-peak. */
const OFF_PEAK_MS = Date.UTC(2026, 0, 5, 16, 0, 0);

function telemetry(patch: Partial<FooterTelemetry> = {}): FooterTelemetry {
  return { ...EMPTY_FOOTER_TELEMETRY, ...patch };
}

function texts(segments: ReturnType<typeof buildTelemetrySegments>): string[] {
  return segments.map((segment) => stripAnsi(segment.text));
}

describe('buildTelemetrySegments', () => {
  it('shows the cache hit rate and session tokens without billing', () => {
    const segments = buildTelemetrySegments(
      telemetry({ sessionCacheHit: 780, sessionCacheMiss: 220, sessionInput: 1_000, sessionOutput: 400 }),
      darkColors,
      OFF_PEAK_MS,
    );

    expect(texts(segments)).toEqual(['cache 78%', 'session 1000 in / 400 out']);
  });

  it('adds the estimated cost with a peak marker inside the peak window', () => {
    const segments = buildTelemetrySegments(
      telemetry({ billingEnabled: true, estimatedCostCny: 0.0123 }),
      darkColors,
      PEAK_MS,
    );

    const [cost] = texts(segments);
    expect(cost).toMatch(/^~¥0\.01/);
    expect(cost).toContain('(peak)');
  });

  it('marks off-peak pricing when the estimate was priced outside peak hours', () => {
    const segments = buildTelemetrySegments(
      telemetry({ billingEnabled: true, estimatedCostCny: 0.0123 }),
      darkColors,
      OFF_PEAK_MS,
    );

    const [cost] = texts(segments);
    expect(cost).toContain('(off-peak)');
  });

  it('shows the balance and flags one below the low-balance threshold', () => {
    const low = buildTelemetrySegments(
      telemetry({ billingEnabled: true, balanceCny: '0.42', balanceAvailable: true }),
      darkColors,
      OFF_PEAK_MS,
    );
    const healthy = buildTelemetrySegments(
      telemetry({ billingEnabled: true, balanceCny: '12.34', balanceAvailable: true }),
      darkColors,
      OFF_PEAK_MS,
    );

    expect(texts(low)).toContain('balance ¥0.42');
    expect(texts(healthy)).toContain('balance ¥12.34');
  });

  it('reports an exhausted balance instead of an amount', () => {
    const segments = buildTelemetrySegments(
      telemetry({ billingEnabled: true, balanceCny: '0', balanceAvailable: false }),
      darkColors,
      OFF_PEAK_MS,
    );

    expect(texts(segments)).toContain('balance insufficient');
  });

  it('keeps cost, balance, and the peak marker out of non-billing models', () => {
    const segments = buildTelemetrySegments(
      telemetry({ billingEnabled: false, estimatedCostCny: 0.5, balanceCny: '9.99' }),
      darkColors,
      PEAK_MS,
    );

    expect(texts(segments)).toEqual([]);
  });
});

describe('joinTelemetrySegments', () => {
  it('drops the lowest-priority segments until the line fits', () => {
    const segments = buildTelemetrySegments(
      telemetry({
        billingEnabled: true,
        sessionCacheHit: 780,
        sessionCacheMiss: 220,
        sessionInput: 1_000,
        sessionOutput: 400,
        estimatedCostCny: 0.0123,
        balanceCny: '12.34',
        balanceAvailable: true,
      }),
      darkColors,
      OFF_PEAK_MS,
    );

    expect(texts(segments)).toHaveLength(4);
    expect(stripAnsi(joinTelemetrySegments(segments, 200))).toContain('session');
    expect(stripAnsi(joinTelemetrySegments(segments, 40))).not.toContain('session');
    expect(stripAnsi(joinTelemetrySegments(segments, 40))).toContain('cache 78%');
  });

  it('returns an empty string when even the first segment does not fit', () => {
    const segments = buildTelemetrySegments(
      telemetry({ sessionCacheHit: 780, sessionCacheMiss: 220 }),
      darkColors,
      OFF_PEAK_MS,
    );

    expect(joinTelemetrySegments(segments, 3)).toBe('');
    expect(joinTelemetrySegments([], 40)).toBe('');
  });
});
