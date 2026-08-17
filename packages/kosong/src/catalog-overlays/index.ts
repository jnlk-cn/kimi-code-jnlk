/**
 * Local catalog overlays merged into models.dev snapshots.
 *
 * models.dev does not list every gateway we want to expose (e.g. Volcengine
 * Ark Coding Plan). Overlay entries use the same shape as models.dev
 * providers and are shallow-merged on top of a fetched or built-in catalog
 * so `/provider` and release snapshots stay in sync without waiting on
 * upstream. Overlay keys win on id collision.
 *
 * Keep `volcengine-coding-plan.json` in sync with the mirror in
 * `packages/agent-core-v2/src/app/kosongConfig/catalogOverlays.ts`.
 */

import type { Catalog, CatalogProviderEntry } from '../catalog';

import volcengineCodingPlan from './volcengine-coding-plan.json' with { type: 'json' };

/** Provider id for Volcengine Ark Coding Plan (OpenAI-compatible coding gateway). */
export const VOLCENGINE_CODING_PLAN_PROVIDER_ID = 'volcengine-coding-plan';

/** All local catalog overlays keyed by provider id. */
export const CATALOG_OVERLAYS: Catalog = {
  [VOLCENGINE_CODING_PLAN_PROVIDER_ID]: volcengineCodingPlan as CatalogProviderEntry,
};

/**
 * Returns a new catalog with local overlays shallow-merged on top of `base`.
 * Overlay provider ids replace any same-id entry from upstream.
 */
export function mergeCatalogOverlays(base: Catalog): Catalog {
  return { ...base, ...CATALOG_OVERLAYS };
}
