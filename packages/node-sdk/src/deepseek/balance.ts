export interface DeepSeekBalanceResult {
  readonly ok: true;
  readonly totalCny: string;
  readonly grantedCny: string;
  readonly toppedUpCny: string;
  readonly available: boolean;
}

export interface DeepSeekBalanceError {
  readonly ok: false;
  readonly message: string;
}

export type FetchDeepSeekBalanceResult = DeepSeekBalanceResult | DeepSeekBalanceError;

function normalizeBaseUrl(baseUrl: string | undefined): string {
  const trimmed = (baseUrl ?? 'https://api.deepseek.com').trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : 'https://api.deepseek.com';
}

export async function fetchDeepSeekBalance(
  apiKey: string,
  baseUrl?: string,
  fetchFn: typeof fetch = fetch,
): Promise<FetchDeepSeekBalanceResult> {
  const key = apiKey.trim();
  if (key.length === 0) {
    return { ok: false, message: 'API key is empty' };
  }

  const url = `${normalizeBaseUrl(baseUrl)}/user/balance`;
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!response.ok) {
    return { ok: false, message: `HTTP ${String(response.status)}` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, message: 'Invalid JSON response' };
  }

  if (body === null || typeof body !== 'object') {
    return { ok: false, message: 'Unexpected balance payload' };
  }

  const record = body as Record<string, unknown>;
  const available = record['is_available'] === true;
  const infos = record['balance_infos'];
  if (!Array.isArray(infos) || infos.length === 0) {
    return { ok: false, message: 'Missing balance_infos' };
  }

  const cnyEntry =
    infos.find(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        (entry as Record<string, unknown>)['currency'] === 'CNY',
    ) ?? infos[0];

  if (cnyEntry === null || typeof cnyEntry !== 'object') {
    return { ok: false, message: 'Invalid balance entry' };
  }

  const entry = cnyEntry as Record<string, unknown>;
  const total = typeof entry['total_balance'] === 'string' ? entry['total_balance'] : null;
  if (total === null) {
    return { ok: false, message: 'Missing total_balance' };
  }

  const granted =
    typeof entry['granted_balance'] === 'string' ? entry['granted_balance'] : '0';
  const toppedUp =
    typeof entry['topped_up_balance'] === 'string' ? entry['topped_up_balance'] : total;

  return {
    ok: true,
    totalCny: total,
    grantedCny: granted,
    toppedUpCny: toppedUp,
    available,
  };
}
