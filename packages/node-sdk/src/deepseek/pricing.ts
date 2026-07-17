import { effectiveModelAlias, type ModelAlias, type ProviderConfig } from '@moonshot-ai/agent-core';

export interface DeepSeekRateCny {
  readonly hit: number;
  readonly miss: number;
  readonly out: number;
}

/** CNY per 1M tokens — off-peak baseline from api-docs.deepseek.com/zh-cn/quick_start/pricing */
export const DEEPSEEK_CNY_RATES: Record<string, DeepSeekRateCny> = {
  'deepseek-v4-flash': { hit: 0.02, miss: 1.0, out: 2.0 },
  'deepseek-v4-pro': { hit: 0.025, miss: 3.0, out: 6.0 },
  'deepseek-chat': { hit: 0.02, miss: 1.0, out: 2.0 },
  'deepseek-reasoner': { hit: 0.02, miss: 1.0, out: 2.0 },
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

export function isDeepSeekProvider(
  model: string,
  availableModels: Record<string, ModelAlias>,
  availableProviders: Record<string, ProviderConfig>,
): boolean {
  const alias = availableModels[model];
  if (alias === undefined) return false;
  const provider = availableProviders[alias.provider];
  if (provider?.type !== 'openai') return false;
  const base = (provider.baseUrl ?? '').toLowerCase();
  return base.includes('api.deepseek.com');
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
  const env = provider.env;
  if (env === undefined) return undefined;
  for (const key of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY']) {
    const value = env[key]?.trim();
    if (value !== undefined && value.length > 0) return value;
  }
  return undefined;
}
