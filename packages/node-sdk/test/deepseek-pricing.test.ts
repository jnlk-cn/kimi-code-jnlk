import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchDeepSeekBalance } from '../src/deepseek/balance';
import {
  beijingHour,
  estimateStepCostCny,
  isDeepSeekPeakHour,
  isDeepSeekProvider,
  peakMultiplierAt,
  resolveDeepSeekProviderApiKey,
  resolveDeepSeekRates,
} from '../src/deepseek/pricing';

describe('deepseek-pricing', () => {
  it('resolves the renamed flash model and the pro rates', () => {
    expect(resolveDeepSeekRates('deepseek-flash')).toEqual({
      hit: 0.02,
      miss: 1.0,
      out: 4.0,
    });
    expect(resolveDeepSeekRates('deepseek/deepseek-v4-flash')).toEqual({
      hit: 0.02,
      miss: 1.0,
      out: 4.0,
    });
    expect(resolveDeepSeekRates('deepseek/deepseek-v4-pro')).toEqual({
      hit: 0.15,
      miss: 4.5,
      out: 13.5,
    });
  });

  it('detects peak hours in Beijing time on weekdays only', () => {
    // 2026-07-08 10:00 Beijing = 02:00 UTC, Wednesday
    const peak = new Date(Date.UTC(2026, 6, 8, 2, 0, 0));
    expect(beijingHour(peak)).toBe(10);
    expect(isDeepSeekPeakHour(peak)).toBe(true);
    expect(peakMultiplierAt(peak.getTime())).toBe(2);

    // 2026-07-08 22:00 Beijing = 14:00 UTC
    const offPeak = new Date(Date.UTC(2026, 6, 8, 14, 0, 0));
    expect(isDeepSeekPeakHour(offPeak)).toBe(false);
    expect(peakMultiplierAt(offPeak.getTime())).toBe(1);

    // 2026-07-11 10:00 Beijing = 02:00 UTC, Saturday
    const weekend = new Date(Date.UTC(2026, 6, 11, 2, 0, 0));
    expect(isDeepSeekPeakHour(weekend)).toBe(false);
    expect(peakMultiplierAt(weekend.getTime())).toBe(1);
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

  it('prices the full flash and pro token mix at the documented rates', () => {
    const at = Date.UTC(2026, 6, 8, 14, 0, 0);
    const usage = { hitTokens: 0, missTokens: 1_000_000, outputTokens: 1_000_000, atMs: at };
    expect(estimateStepCostCny({ ...usage, modelId: 'deepseek-flash' })).toBeCloseTo(5, 6);
    expect(estimateStepCostCny({ ...usage, modelId: 'deepseek-v4-pro' })).toBeCloseTo(18, 6);
  });

  it('detects the DeepSeek provider by base URL for every wire type', () => {
    const models = {
      ds: {
        provider: 'deepseek',
        model: 'deepseek-flash',
        maxContextSize: 1_000_000,
      },
    };
    expect(
      isDeepSeekProvider('ds', models, {
        deepseek: { type: 'openai', baseUrl: 'https://api.deepseek.com' },
      }),
    ).toBe(true);
    expect(
      isDeepSeekProvider('ds', models, {
        deepseek: { type: 'anthropic', baseUrl: 'https://api.deepseek.com/anthropic' },
      }),
    ).toBe(true);
    expect(
      isDeepSeekProvider(
        'k2',
        { k2: { provider: 'kimi', model: 'kimi-k2', maxContextSize: 1_000_000 } },
        { kimi: { type: 'openai', baseUrl: 'https://api.kimi.com/coding/v1' } },
      ),
    ).toBe(false);
  });

  it('resolves the provider key from apiKey, apiKeyEnv, and env', () => {
    expect(resolveDeepSeekProviderApiKey({ type: 'openai', apiKey: ' key ' })).toBe('key');
    process.env['KIMI_TEST_DEEPSEEK_KEY'] = 'env-key';
    expect(
      resolveDeepSeekProviderApiKey({ type: 'openai', apiKeyEnv: 'KIMI_TEST_DEEPSEEK_KEY' }),
    ).toBe('env-key');
    delete process.env['KIMI_TEST_DEEPSEEK_KEY'];
    expect(
      resolveDeepSeekProviderApiKey({ type: 'openai', env: { DEEPSEEK_API_KEY: 'env-table' } }),
    ).toBe('env-table');
  });
});

describe('fetchDeepSeekBalance', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves the API root even when base_url carries a wire suffix', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        is_available: true,
        balance_infos: [
          {
            currency: 'CNY',
            total_balance: '12.34',
            granted_balance: '1.00',
            topped_up_balance: '11.34',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchDeepSeekBalance('key', 'https://api.deepseek.com/anthropic');
    expect(result).toMatchObject({ ok: true, totalCny: '12.34' });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.deepseek.com/user/balance');
  });
});
