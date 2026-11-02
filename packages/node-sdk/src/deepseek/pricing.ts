import { effectiveModelAlias, type ModelAlias, type ProviderConfig } from '#/config/index';

export interface DeepSeekRateCny {
  readonly hit: number;
  readonly miss: number;
  readonly out: number;
}

/** CNY per 1M tokens — off-peak baseline from api-docs.deepseek.com/zh-cn/quick_start/pricing */
export const DEEPSEEK_CNY_RATES: Record<string, DeepSeekRateCny> = {
  'deepseek-flash': { hit: 0.02, miss: 1.0, out: 4.0 },
  'deepseek-v4-flash': { hit: 0.02, miss: 1.0, out: 4.0 },
  'deepseek-v4-flash-vision-exp': { hit: 0.02, miss: 1.0, out: 4.0 },
  'deepseek-v4-pro': { hit: 0.15, miss: 4.5, out: 13.5 },
};

export const DEEPSEEK_PEAK_MULTIPLIER = 2;

/** Balance poll interval aligned with the CLI footer (5 minutes). */
export const DEEPSEEK_BALANCE_POLL_MS = 300_000;

export { beijingHour, isDeepSeekPeakHour } from './format';

export function normalizeDeepSeekModelId(modelId: string): string {
  const slash = modelId.lastIndexOf('/');
  return (slash >= 0 ? modelId.slice(slash + 1) : modelId).toLowerCase();
}

export function resolveDeepSeekRates(modelId: string): DeepSeekRateCny | undefined {
  return DEEPSEEK_CNY_RATES[normalizeDeepSeekModelId(modelId)];
}

import { isDeepSeekPeakHour } from './format';

export function peakMultiplierAt(atMs: number): number {
  return isDeepSeekPeakHour(new Date(atMs)) ? DEEPSEEK_PEAK_MULTIPLIER : 1;
}

export interface StepCostInput {
  readonly modelId: string;
  readonly hitTokens: number;
  readonly missTokens: number;
  readonly outputTokens: number;
  readonly atMs: number;
}

export function estimateStepCostCny(input: StepCostInput): number {
  const rates = resolveDeepSeekRates(input.modelId);
  if (rates === undefined) return 0;
  const mult = peakMultiplierAt(input.atMs);
  const hit = Math.max(0, input.hitTokens);
  const miss = Math.max(0, input.missTokens);
  const out = Math.max(0, input.outputTokens);
  const base =
    (hit / 1_000_000) * rates.hit +
    (miss / 1_000_000) * rates.miss +
    (out / 1_000_000) * rates.out;
  return base * mult;
}

export function isDeepSeekHost(baseUrl: string | undefined): boolean {
  if (baseUrl === undefined) return false;
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === 'deepseek.com' || host.endsWith('.deepseek.com');
  } catch {
    return false;
  }
}

export function isDeepSeekProvider(
  model: string,
  availableModels: Record<string, ModelAlias>,
  availableProviders: Record<string, ProviderConfig>,
): boolean {
  const alias = availableModels[model];
  if (alias === undefined) return false;
  const provider = availableProviders[alias.provider];
  return isDeepSeekHost(provider?.baseUrl);
}

export function wireModelId(
  model: string,
  availableModels: Record<string, ModelAlias>,
): string {
  const raw = availableModels[model];
  if (raw === undefined) return model;
  const effective = effectiveModelAlias(raw);
  return effective?.model ?? model;
}

export function resolveDeepSeekProviderApiKey(
  provider: ProviderConfig | undefined,
): string | undefined {
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
