/**
 * Local catalog overlays merged into models.dev snapshots.
 *
 * Official Kimi entries are stripped snapshots of models.dev `api.json`
 * (`kimi-for-coding`, `moonshotai`, `moonshotai-cn`). Other overlays fill
 * gaps models.dev does not ship (Volcengine Ark Coding Plan) or lag on
 * (DeepSeek 2026-08-16 peak/off-peak prices). Overlay keys win on collision.
 *
 * Keep JSON overlays in sync with the mirror in
 * `packages/agent-core-v2/src/app/kosongConfig/catalogOverlays.ts`.
 *
 * DeepSeek `cost` values are official off-peak USD / 1M tokens (peak is 2×;
 * peak hours 01:00–04:00 and 06:00–10:00 UTC).
 */

import type { Catalog, CatalogProviderEntry } from '../catalog';

import deepseekOfficial from './deepseek.json' with { type: 'json' };
import kimiForCoding from './kimi-for-coding.json' with { type: 'json' };
import moonshotai from './moonshotai.json' with { type: 'json' };
import moonshotaiCn from './moonshotai-cn.json' with { type: 'json' };
import volcengineCodingPlan from './volcengine-coding-plan.json' with { type: 'json' };

/** Official Kimi Code (Anthropic-compatible coding API). */
export const KIMI_FOR_CODING_PROVIDER_ID = 'kimi-for-coding';

/** Official Kimi Open Platform (global, api.moonshot.ai). */
export const MOONSHOTAI_PROVIDER_ID = 'moonshotai';

/** Official Kimi Open Platform (China, api.moonshot.cn). */
export const MOONSHOTAI_CN_PROVIDER_ID = 'moonshotai-cn';

/** Provider id for Volcengine Ark Coding Plan (OpenAI-compatible coding gateway). */
export const VOLCENGINE_CODING_PLAN_PROVIDER_ID = 'volcengine-coding-plan';

/** Provider id for DeepSeek's official OpenAI-compatible API. */
export const DEEPSEEK_PROVIDER_ID = 'deepseek';

/**
 * Built-in overlay ids in picker order: official Kimi first, then the
 * other local presets. `/provider` → Built-in provider uses this list
 * without fetching models.dev.
 */
export const BUILTIN_CATALOG_PROVIDER_IDS = [
  KIMI_FOR_CODING_PROVIDER_ID,
  MOONSHOTAI_CN_PROVIDER_ID,
  MOONSHOTAI_PROVIDER_ID,
  VOLCENGINE_CODING_PLAN_PROVIDER_ID,
  DEEPSEEK_PROVIDER_ID,
] as const;

/** All local catalog overlays keyed by provider id. */
export const CATALOG_OVERLAYS: Catalog = {
  [KIMI_FOR_CODING_PROVIDER_ID]: kimiForCoding as CatalogProviderEntry,
  [MOONSHOTAI_CN_PROVIDER_ID]: moonshotaiCn as CatalogProviderEntry,
  [MOONSHOTAI_PROVIDER_ID]: moonshotai as CatalogProviderEntry,
  [VOLCENGINE_CODING_PLAN_PROVIDER_ID]: volcengineCodingPlan as CatalogProviderEntry,
  [DEEPSEEK_PROVIDER_ID]: deepseekOfficial as CatalogProviderEntry,
};

/**
 * Returns a new catalog with local overlays merged on top of `base`.
 * Unknown provider ids are added; known ids merge provider fields and
 * per-model entries so a cost patch does not drop upstream metadata.
 */
export function mergeCatalogOverlays(base: Catalog): Catalog {
  const merged: Catalog = { ...base };
  for (const [id, overlay] of Object.entries(CATALOG_OVERLAYS)) {
    merged[id] = mergeProviderEntry(merged[id], overlay);
  }
  return merged;
}

function mergeProviderEntry(
  base: CatalogProviderEntry | undefined,
  overlay: CatalogProviderEntry,
): CatalogProviderEntry {
  if (base === undefined) return overlay;
  const models: NonNullable<CatalogProviderEntry['models']> = { ...base.models };
  for (const [modelId, overlayModel] of Object.entries(overlay.models ?? {})) {
    models[modelId] = { ...models[modelId], ...overlayModel };
  }
  return { ...base, ...overlay, models };
}
