import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  DEFAULT_CATALOG_URL,
  fetchCatalog,
  loadBuiltInCatalog,
  type Catalog,
} from '@moonshot-ai/kimi-code-sdk';

import { BUILT_IN_CATALOG_JSON } from '#/built-in-catalog';

export type KnownProviderCatalogSource = 'remote' | 'built-in' | 'local';

export interface KnownProviderCatalogResult {
  readonly catalog: Catalog;
  readonly source: KnownProviderCatalogSource;
  readonly sourceLabel: string;
}

function localCatalogCandidates(): readonly string[] {
  const cwd = process.cwd();
  return [
    resolve(cwd, 'catalog/api.json'),
    resolve(cwd, '../catalog/api.json'),
    resolve(cwd, '../../catalog/api.json'),
  ];
}

async function loadLocalCatalog(): Promise<KnownProviderCatalogResult | undefined> {
  for (const path of localCatalogCandidates()) {
    try {
      const text = await readFile(path, 'utf-8');
      const catalog = loadBuiltInCatalog(text);
      if (catalog !== undefined) {
        return { catalog, source: 'local', sourceLabel: path };
      }
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

/**
 * Loads the known-provider catalog. Tries the remote GitHub mirror first, then
 * falls back to the release build's inlined catalog, then to repo-local
 * `catalog/api.json` (dev / fork checkout). Fallbacks apply only when fetching
 * the default URL — an explicit `--url` override must succeed or fail as given.
 */
export async function loadKnownProviderCatalog(
  url: string = DEFAULT_CATALOG_URL,
  signal?: AbortSignal,
): Promise<KnownProviderCatalogResult> {
  const allowFallback = url === DEFAULT_CATALOG_URL;

  try {
    const catalog = await fetchCatalog(url, signal);
    return { catalog, source: 'remote', sourceLabel: url };
  } catch (remoteError) {
    if (!allowFallback) throw remoteError;

    const builtIn = loadBuiltInCatalog(BUILT_IN_CATALOG_JSON);
    if (builtIn !== undefined) {
      return { catalog: builtIn, source: 'built-in', sourceLabel: 'built-in catalog' };
    }

    const local = await loadLocalCatalog();
    if (local !== undefined) return local;

    throw remoteError;
  }
}
