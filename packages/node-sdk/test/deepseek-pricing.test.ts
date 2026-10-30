import { describe, expect, it } from 'vitest';

import {
  beijingHour,
  estimateStepCostCny,
  isDeepSeekPeakHour,
  isDeepSeekProvider,
  peakMultiplierAt,
  resolveDeepSeekRates,
} from '../src/deepseek/pricing';

describe('deepseek-pricing', () => {
  it('resolves flash and pro rates', () => {
    expect(resolveDeepSeekRates('deepseek-v4-flash')).toEqual({
      hit: 0.02,
      miss: 1.0,
      out: 2.0,
    });
    expect(resolveDeepSeekRates('deepseek/deepseek-v4-pro')).toEqual({
      hit: 0.025,
      miss: 3.0,
      out: 6.0,
    });
  });

  it('detects peak hours in Beijing time', () => {
    // 2026-07-08 10:00 Beijing = 02:00 UTC
    const peak = new Date(Date.UTC(2026, 6, 8, 2, 0, 0));
    expect(beijingHour(peak)).toBe(10);
    expect(isDeepSeekPeakHour(peak)).toBe(true);
    expect(peakMultiplierAt(peak.getTime())).toBe(2);

    // 2026-07-08 22:00 Beijing = 14:00 UTC
    const offPeak = new Date(Date.UTC(2026, 6, 8, 14, 0, 0));
    expect(isDeepSeekPeakHour(offPeak)).toBe(false);
    expect(peakMultiplierAt(offPeak.getTime())).toBe(1);
  });

  it('estimates step cost with peak multiplier', () => {
    const offPeakMs = Date.UTC(2026, 6, 8, 14, 0, 0);
    const offPeak = estimateStepCostCny({
      modelId: 'deepseek-v4-flash',
      hitTokens: 1_000_000,
      missTokens: 0,
      outputTokens: 0,
      atMs: offPeakMs,
    });
    expect(offPeak).toBeCloseTo(0.02, 6);

    const peakMs = Date.UTC(2026, 6, 8, 2, 0, 0);
    const peak = estimateStepCostCny({
      modelId: 'deepseek-v4-flash',
      hitTokens: 1_000_000,
      missTokens: 0,
      outputTokens: 0,
      atMs: peakMs,
    });
    expect(peak).toBeCloseTo(0.04, 6);
  });

  it('detects DeepSeek provider by base URL', () => {
    expect(
      isDeepSeekProvider(
        'ds',
        {
          ds: {
            provider: 'deepseek',
            model: 'deepseek-v4-flash',
            maxContextSize: 1_000_000,
          },
        },
        {
          deepseek: { type: 'openai', baseUrl: 'https://api.deepseek.com' },
        },
      ),
    ).toBe(true);

    expect(
      isDeepSeekProvider(
        'k2',
        {
          k2: {
            provider: 'kimi',
            model: 'kimi-k2',
            maxContextSize: 1_000_000,
          },
        },
        {
          kimi: { type: 'kimi', baseUrl: 'https://api.kimi.com/coding/v1' },
        },
      ),
    ).toBe(false);
  });
});
