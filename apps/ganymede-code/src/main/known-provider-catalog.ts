import {
  DEFAULT_CATALOG_URL,
  fetchCatalog,
  loadBuiltInCatalog,
  type Catalog,
} from '@moonshot-ai/kimi-code-sdk';

import BUILT_IN_CATALOG_JSON from '../../../../catalog/api.json?raw';

export async function loadKnownProviderCatalog(): Promise<Catalog> {
  try {
    return await fetchCatalog(DEFAULT_CATALOG_URL);
  } catch (remoteError) {
    const builtIn = loadBuiltInCatalog(BUILT_IN_CATALOG_JSON);
    if (builtIn !== undefined) return builtIn;
    throw remoteError;
  }
}
