import type { KimiConfig, ModelAlias } from '#/config/index';

import { isDeepSeekHost } from './pricing';

/**
 * The working budget a DeepSeek session fills before compacting. DeepSeek
 * declares a 1M window, but requests at that size are slow, quadratically
 * pricier on uncached input, and degrade instruction following; 256K matches
 * the default this CLI gives custom models.
 */
export const DEEPSEEK_DEFAULT_INPUT_SIZE = 262_144;

function capByModel(value: number, declared: number): number {
  return declared <= 0 ? value : Math.min(value, declared);
}

function defaultedAlias(alias: ModelAlias): ModelAlias {
  return {
    ...alias,
    maxInputSize: capByModel(DEEPSEEK_DEFAULT_INPUT_SIZE, alias.maxContextSize),
  };
}

/**
 * Applies this fork's DeepSeek working budget to every alias served by
 * `api.deepseek.com`: a 256K input budget (`max_input_size`), leaving both the
 * declared 1M window and the declared output ceiling untouched. Call it on a
 * freshly catalog-imported config, before persisting it.
 */
export function applyDeepSeekModelDefaults(config: KimiConfig): KimiConfig {
  const models = config.models;
  if (models === undefined) return config;
  let changed = false;
  const next: Record<string, ModelAlias> = {};
  for (const [name, alias] of Object.entries(models)) {
    const baseUrl = config.providers?.[alias.provider]?.baseUrl ?? alias.baseUrl;
    if (!isDeepSeekHost(baseUrl)) {
      next[name] = alias;
      continue;
    }
    next[name] = defaultedAlias(alias);
    changed = true;
  }
  return changed ? { ...config, models: next } : config;
}
