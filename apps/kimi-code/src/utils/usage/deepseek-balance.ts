import {
  fetchDeepSeekBalance,
  isDeepSeekProvider,
  resolveDeepSeekProviderApiKey,
  type ModelAlias,
  type ProviderConfig,
} from '@moonshot-ai/kimi-code-sdk';

export interface DeepSeekBalanceReport {
  readonly totalCny: string;
  readonly grantedCny: string;
  readonly toppedUpCny: string;
  readonly available: boolean;
}

export interface DeepSeekBalanceLookup {
  readonly balance?: DeepSeekBalanceReport;
  readonly error?: string;
}

/**
 * Balance lookup for the active model, shared by `/usage` and the footer
 * billing line. Undefined when the model does not run on DeepSeek or the
 * provider has no API key to authenticate the request with.
 */
export async function loadDeepSeekBalance(
  modelAlias: string | undefined,
  models: Record<string, ModelAlias>,
  providers: Record<string, ProviderConfig>,
): Promise<DeepSeekBalanceLookup | undefined> {
  if (modelAlias === undefined) return undefined;
  if (!isDeepSeekProvider(modelAlias, models, providers)) return undefined;
  const alias = models[modelAlias];
  const provider = alias === undefined ? undefined : providers[alias.provider];
  const apiKey = resolveDeepSeekProviderApiKey(provider);
  if (apiKey === undefined) return undefined;
  const result = await fetchDeepSeekBalance(apiKey, provider?.baseUrl);
  return result.ok
    ? {
        balance: {
          totalCny: result.totalCny,
          grantedCny: result.grantedCny,
          toppedUpCny: result.toppedUpCny,
          available: result.available,
        },
      }
    : { error: result.message };
}
