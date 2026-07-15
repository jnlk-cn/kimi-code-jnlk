import type { Catalog, KimiConfig } from '@moonshot-ai/kimi-code-sdk';
import { describe, expect, it } from 'vitest';

import {
  catalogProviderOptions,
  modelConfigurationFromConfig,
  requireModelSelection,
  thinkingConfigFromEffort,
} from '../src/main/model-configuration';

const deepSeekConfig = {
  providers: {
    deepseek: {
      type: 'openai',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'YOUR_API_KEY',
    },
  },
  models: {
    'deepseek/deepseek-v4-pro': {
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      maxContextSize: 1_000_000,
      displayName: 'DeepSeek V4 Pro',
      capabilities: ['thinking', 'tool_use'],
    },
    'deepseek/deepseek-v4-flash': {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      maxContextSize: 1_000_000,
      displayName: 'DeepSeek V4 Flash',
      capabilities: ['thinking', 'tool_use'],
      supportEfforts: ['high', 'max'],
      defaultEffort: 'high',
    },
  },
  defaultModel: 'deepseek/deepseek-v4-pro',
  thinking: { enabled: true, effort: 'medium' },
} satisfies KimiConfig;

describe('desktop model configuration', () => {
  it('normalizes DeepSeek V4 Pro and Flash to their supported efforts', () => {
    const configuration = modelConfigurationFromConfig(deepSeekConfig);

    expect(configuration.defaultThinking).toBe('high');
    expect(configuration.models).toEqual([
      expect.objectContaining({
        id: 'deepseek/deepseek-v4-pro',
        label: 'DeepSeek V4 Pro',
        provider: 'deepseek',
        thinkingEfforts: ['off', 'high', 'max'],
        defaultThinking: 'high',
      }),
      expect.objectContaining({
        id: 'deepseek/deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        thinkingEfforts: ['off', 'high', 'max'],
        defaultThinking: 'high',
      }),
    ]);
  });

  it('rejects an effort the selected model cannot send', () => {
    const configuration = modelConfigurationFromConfig(deepSeekConfig);

    expect(() =>
      requireModelSelection(configuration, 'deepseek/deepseek-v4-pro', 'medium'),
    ).toThrow(/不支持思考档位/);
    expect(() =>
      requireModelSelection(configuration, 'deepseek/deepseek-v4-flash', 'max'),
    ).not.toThrow();
  });

  it('persists boolean and concrete thinking choices like Kimi Code', () => {
    expect(thinkingConfigFromEffort('off')).toEqual({ enabled: false });
    expect(thinkingConfigFromEffort('on')).toEqual({ enabled: true });
    expect(thinkingConfigFromEffort('max')).toEqual({ enabled: true, effort: 'max' });
  });
});

describe('desktop known-provider catalog', () => {
  it('keeps both DeepSeek V4 variants and their wire-compatible metadata', () => {
    const catalog: Catalog = {
      deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        type: 'openai',
        api: 'https://api.deepseek.com',
        env: ['DEEPSEEK_API_KEY'],
        models: {
          pro: {
            id: 'deepseek-v4-pro',
            name: 'DeepSeek V4 Pro',
            reasoning: true,
            reasoning_options: [{ type: 'effort', values: ['high', 'max'] }],
            interleaved: { field: 'reasoning_content' },
            limit: { context: 1_000_000, output: 384_000 },
          },
          flash: {
            id: 'deepseek-v4-flash',
            name: 'DeepSeek V4 Flash',
            reasoning: true,
            reasoning_options: [{ type: 'effort', values: ['high', 'max'] }],
            interleaved: { field: 'reasoning_content' },
            limit: { context: 1_000_000, output: 384_000 },
          },
        },
      },
    };

    const provider = catalogProviderOptions(catalog)[0];
    expect(provider).toMatchObject({
      id: 'deepseek',
      label: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com',
      env: ['DEEPSEEK_API_KEY'],
    });
    expect(provider?.models.map((model) => ({
      id: model.id,
      thinkingEfforts: model.thinkingEfforts,
    }))).toEqual([
      { id: 'deepseek/deepseek-v4-pro', thinkingEfforts: ['off', 'high', 'max'] },
      { id: 'deepseek/deepseek-v4-flash', thinkingEfforts: ['off', 'high', 'max'] },
    ]);
  });
});
