import {
  catalogModelToAlias,
  catalogProviderModels,
  deepSeekV4Efforts,
  effectiveModelAlias,
  inferWireType,
  type Catalog,
  type KimiConfig,
  type ModelAlias,
  type ThinkingConfig,
} from '@moonshot-ai/kimi-code-sdk';

import type {
  CatalogProviderOption,
  ModelConfiguration,
  ModelOption,
} from '../shared/contracts';

export function modelConfigurationFromConfig(config: KimiConfig): ModelConfiguration {
  const models = Object.entries(config.models ?? {}).map(([id, alias]) =>
    modelOptionFromAlias(id, alias),
  );
  const defaultOption = models.find((model) => model.id === config.defaultModel);
  return {
    defaultModel: config.defaultModel,
    defaultThinking:
      defaultOption === undefined
        ? undefined
        : configuredThinking(config.thinking, defaultOption),
    models,
  };
}

export function catalogProviderOptions(catalog: Catalog): readonly CatalogProviderOption[] {
  return Object.entries(catalog)
    .flatMap(([providerId, entry]) => {
      if (inferWireType(entry) === undefined) return [];
      const models = catalogProviderModels(entry).map((model) =>
        modelOptionFromAlias(
          `${providerId}/${model.id}`,
          catalogModelToAlias(providerId, model),
          entry.name ?? providerId,
        ),
      );
      if (models.length === 0) return [];
      return [{
        id: providerId,
        label: entry.name ?? providerId,
        baseUrl: entry.api,
        env: entry.env ?? [],
        models,
      }];
    })
    .toSorted((a, b) => a.label.localeCompare(b.label));
}

export function modelOptionFromAlias(
  id: string,
  alias: ModelAlias,
  providerLabel?: string,
): ModelOption {
  const effective = effectiveModelAlias(alias);
  const fallback = deepSeekV4Efforts(effective.model);
  const capabilities = effective.capabilities ?? [];
  const thinkingRequired = capabilities.includes('always_thinking');
  const supportsThinking =
    thinkingRequired ||
    capabilities.includes('thinking') ||
    effective.adaptiveThinking === true ||
    fallback !== undefined;
  const supported =
    effective.supportEfforts !== undefined && effective.supportEfforts.length > 0
      ? effective.supportEfforts
      : fallback?.supportEfforts ?? [];
  const thinkingEfforts = supported.length > 0
    ? thinkingRequired ? [...supported] : ['off', ...supported]
    : thinkingRequired
      ? ['on']
      : supportsThinking
        ? ['on', 'off']
        : ['off'];
  const declaredDefault = effective.defaultEffort ?? fallback?.defaultEffort;
  const defaultThinking =
    declaredDefault !== undefined && thinkingEfforts.includes(declaredDefault)
      ? declaredDefault
      : supported[Math.floor(supported.length / 2)] ?? (supportsThinking ? 'on' : 'off');
  return {
    id,
    label: effective.displayName ?? effective.model ?? id,
    provider: providerLabel ?? providerDisplayName(effective.provider),
    thinkingEfforts,
    defaultThinking,
    thinkingRequired,
  };
}

export function configuredThinking(
  thinking: ThinkingConfig | undefined,
  model: ModelOption,
): string {
  if (thinking?.enabled === false && !model.thinkingRequired) return 'off';
  if (
    thinking?.effort !== undefined &&
    model.thinkingEfforts.includes(thinking.effort)
  ) {
    return thinking.effort;
  }
  return model.defaultThinking;
}

export function thinkingConfigFromEffort(effort: string): ThinkingConfig {
  if (effort === 'off') return { enabled: false };
  if (effort === 'on') return { enabled: true };
  return { enabled: true, effort };
}

export function requireModelSelection(
  configuration: ModelConfiguration,
  modelId: string,
  thinking: string,
): ModelOption {
  const model = configuration.models.find((option) => option.id === modelId);
  if (model === undefined) throw new Error(`模型“${modelId}”尚未配置。`);
  if (!model.thinkingEfforts.includes(thinking)) {
    throw new Error(
      `模型“${model.label}”不支持思考档位“${thinking}”；可用档位：${model.thinkingEfforts.join(', ')}。`,
    );
  }
  return model;
}

function providerDisplayName(provider: string): string {
  if (provider === 'managed:kimi-code') return 'Kimi Code';
  if (provider.startsWith('managed:')) return provider.slice('managed:'.length);
  return provider;
}
