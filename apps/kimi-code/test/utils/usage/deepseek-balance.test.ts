import { describe, expect, it } from 'vitest';

import { fetchDeepSeekBalance } from '#/utils/usage/deepseek-balance';

describe('fetchDeepSeekBalance', () => {
  it('parses CNY balance payload', async () => {
    const fetchFn = async () =>
      new Response(
        JSON.stringify({
          is_available: true,
          balance_infos: [
            {
              currency: 'CNY',
              total_balance: '12.38',
              granted_balance: '0.10',
              topped_up_balance: '12.28',
            },
          ],
        }),
        { status: 200 },
      );

    const result = await fetchDeepSeekBalance('sk-test', 'https://api.deepseek.com', fetchFn);
    expect(result).toEqual({
      ok: true,
      totalCny: '12.38',
      grantedCny: '0.10',
      toppedUpCny: '12.28',
      available: true,
    });
  });

  it('returns error on HTTP failure', async () => {
    const fetchFn = async () => new Response('', { status: 401 });
    const result = await fetchDeepSeekBalance('sk-test', undefined, fetchFn);
    expect(result).toEqual({ ok: false, message: 'HTTP 401' });
  });
});
