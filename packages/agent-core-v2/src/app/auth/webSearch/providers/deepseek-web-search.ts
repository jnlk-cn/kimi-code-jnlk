import type { WebSearchProvider, WebSearchResult } from '#/agent/tools/web-search/web-search';
import { Error2, ErrorCodes } from '#/errors';
import type { ProviderConfig } from '#/llm-adapter/provider/provider';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const SEARCH_PATH = '/v1/tools/search';
const SEARCH_RESULT_COUNT = 10;

interface DeepSeekSearchHit {
  readonly title?: string | null;
  readonly url?: string | null;
  readonly snippet?: string | null;
  readonly summary?: string | null;
  readonly site_name?: string | null;
  readonly date?: string | null;
}

interface DeepSeekSearchResponse {
  readonly results?: readonly DeepSeekSearchHit[];
}

export function isDeepSeekProviderBaseUrl(baseUrl: string | undefined): boolean {
  if (baseUrl === undefined || baseUrl.length === 0) return false;
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === 'deepseek.com' || host.endsWith('.deepseek.com');
  } catch {
    return false;
  }
}

export function deepSeekProviderApiKey(provider: ProviderConfig | undefined): string | undefined {
  if (provider === undefined) return undefined;
  if (provider.apiKey !== undefined && provider.apiKey.trim().length > 0) {
    return provider.apiKey.trim();
  }
  const envName = provider.apiKeyEnv?.trim();
  if (envName !== undefined && envName.length > 0) {
    const value = process.env[envName]?.trim();
    if (value !== undefined && value.length > 0) return value;
  }
  const env = provider.env;
  if (env === undefined) return undefined;
  for (const key of ['DEEPSEEK_API_KEY', 'OPENAI_API_KEY']) {
    const value = env[key]?.trim();
    if (value !== undefined && value.length > 0) return value;
  }
  return undefined;
}

function deepSeekApiRoot(baseUrl: string | undefined): string {
  const trimmed = (baseUrl ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  if (trimmed.length === 0) return DEFAULT_BASE_URL;
  return trimmed.replace(/\/(?:v1|anthropic|beta)$/i, '').replace(/\/+$/, '') || DEFAULT_BASE_URL;
}

function deepSeekSearchUrl(baseUrl: string | undefined): string {
  return `${deepSeekApiRoot(baseUrl)}${SEARCH_PATH}`;
}

export interface DeepSeekWebSearchProviderOptions {
  readonly baseUrl?: string;
  readonly apiKey: string;
  readonly defaultHeaders?: Record<string, string>;
  readonly customHeaders?: Record<string, string>;
  readonly fetchImpl?: typeof fetch;
}

export class DeepSeekWebSearchProvider implements WebSearchProvider {
  private readonly url: string;
  private readonly apiKey: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly customHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DeepSeekWebSearchProviderOptions) {
    this.url = deepSeekSearchUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.customHeaders = options.customHeaders ?? {};
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async search(
    query: string,
    options?: {
      toolCallId?: string;
      signal?: AbortSignal;
    },
  ): Promise<WebSearchResult[]> {
    const response = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: {
        ...this.defaultHeaders,
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...this.customHeaders,
      },
      body: JSON.stringify({ query, count: SEARCH_RESULT_COUNT, need_content: false }),
      signal: options?.signal,
    });

    if (response.status !== 200) {
      const detail = await safeReadText(response);
      throw new Error2(
        ErrorCodes.WEB_FETCH_FAILED,
        `DeepSeek search request failed: HTTP ${String(response.status)}. ${detail}`.trim(),
        { details: { status: response.status } },
      );
    }

    const json = (await response.json()) as DeepSeekSearchResponse;
    const hits = Array.isArray(json.results) ? json.results : [];
    return hits.map((hit): WebSearchResult => {
      const result: WebSearchResult = {
        title: hit.title ?? '',
        url: hit.url ?? '',
        snippet: nonEmpty(hit.snippet) ?? nonEmpty(hit.summary) ?? '',
      };
      const date = nonEmpty(hit.date);
      if (date !== undefined) result.date = date;
      const siteName = nonEmpty(hit.site_name);
      if (siteName !== undefined) result.siteName = siteName;
      return result;
    });
  }
}

function nonEmpty(value: string | null | undefined): string | undefined {
  return value !== null && value !== undefined && value.trim().length > 0 ? value : undefined;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
