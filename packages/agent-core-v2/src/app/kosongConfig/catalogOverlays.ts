/**
 * `kosongConfig` domain — local models.dev catalog overlays.
 *
 * Mirrors `packages/kosong/src/catalog-overlays` for the v2 engine (v2 does
 * not depend on the packages/kosong package). Keep the Kimi Code, Volcengine,
 * and DeepSeek entries in sync with the JSON overlays there.
 */

import type { ModelsDevCatalog, ModelsDevModelEntry, ModelsDevProviderEntry } from './modelsDev';

import kimiForCoding from './catalog-overlays/kimi-for-coding.json' with { type: 'json' };
import moonshotai from './catalog-overlays/moonshotai.json' with { type: 'json' };
import moonshotaiCn from './catalog-overlays/moonshotai-cn.json' with { type: 'json' };

export const VOLCENGINE_CODING_PLAN_PROVIDER_ID = 'volcengine-coding-plan';
export const DEEPSEEK_PROVIDER_ID = 'deepseek';
export const KIMI_FOR_CODING_PROVIDER_ID = 'kimi-for-coding';
export const MOONSHOTAI_PROVIDER_ID = 'moonshotai';
export const MOONSHOTAI_CN_PROVIDER_ID = 'moonshotai-cn';

const volcengineCodingPlan: ModelsDevProviderEntry = {
  id: VOLCENGINE_CODING_PLAN_PROVIDER_ID,
  name: 'Volcengine Ark Coding Plan',
  api: 'https://ark.cn-beijing.volces.com/api/coding/v3',
  npm: '@ai-sdk/openai-compatible',
  env: ['ARK_API_KEY'],
  models: {
    'ark-code-latest': {
      id: 'ark-code-latest',
      name: 'Ark Code Latest (Auto)',
      family: 'ark-code',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text', 'image'], output: ['text'] },
      limit: { context: 262144, output: 65536 },
    },
    'doubao-seed-2.1-turbo': {
      id: 'doubao-seed-2.1-turbo',
      name: 'Doubao Seed 2.1 Turbo',
      family: 'doubao-seed',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text', 'image'], output: ['text'] },
      limit: { context: 262144, output: 65536 },
    },
    'doubao-seed-2.0-code': {
      id: 'doubao-seed-2.0-code',
      name: 'Doubao Seed 2.0 Code',
      family: 'doubao-seed',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text', 'image'], output: ['text'] },
      limit: { context: 262144, output: 65536 },
    },
    'doubao-seed-2.0-pro': {
      id: 'doubao-seed-2.0-pro',
      name: 'Doubao Seed 2.0 Pro',
      family: 'doubao-seed',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text', 'image'], output: ['text'] },
      limit: { context: 262144, output: 65536 },
    },
    'doubao-seed-2.0-lite': {
      id: 'doubao-seed-2.0-lite',
      name: 'Doubao Seed 2.0 Lite',
      family: 'doubao-seed',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text', 'image'], output: ['text'] },
      limit: { context: 262144, output: 65536 },
    },
    'doubao-seed-code': {
      id: 'doubao-seed-code',
      name: 'Doubao Seed Code',
      family: 'doubao-seed',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text', 'image'], output: ['text'] },
      limit: { context: 262144, output: 65536 },
    },
    'deepseek-v3.2': {
      id: 'deepseek-v3.2',
      name: 'DeepSeek V3.2',
      family: 'deepseek',
      tool_call: true,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      modalities: { input: ['text'], output: ['text'] },
      limit: { context: 128000, output: 65536 },
    },
    'deepseek-v4-pro': {
      id: 'deepseek-v4-pro',
      name: 'DeepSeek V4 Pro',
      family: 'deepseek-thinking',
      tool_call: true,
      reasoning: true,
      reasoning_options: [{ type: 'toggle' }],
      interleaved: { field: 'reasoning_content' },
      modalities: { input: ['text'], output: ['text'] },
      limit: { context: 1048576, output: 384000 },
    },
    'deepseek-v4-flash': {
      id: 'deepseek-v4-flash',
      name: 'DeepSeek V4 Flash',
      family: 'deepseek-flash',
      tool_call: true,
      reasoning: true,
      reasoning_options: [{ type: 'toggle' }],
      interleaved: { field: 'reasoning_content' },
      modalities: { input: ['text'], output: ['text'] },
      limit: { context: 1048576, output: 384000 },
    },
    'glm-4.7': {
      id: 'glm-4.7',
      name: 'GLM-4.7',
      family: 'glm',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text', 'image'], output: ['text'] },
      limit: { context: 204800, output: 131072 },
    },
    'glm-5.1': {
      id: 'glm-5.1',
      name: 'GLM-5.1',
      family: 'glm',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text'], output: ['text'] },
      limit: { context: 202752, output: 131072 },
    },
    'glm-5.2': {
      id: 'glm-5.2',
      name: 'GLM-5.2',
      family: 'glm',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text'], output: ['text'] },
      limit: { context: 1048576, output: 131072 },
    },
    'kimi-k2.5': {
      id: 'kimi-k2.5',
      name: 'Kimi K2.5',
      family: 'kimi-k2',
      tool_call: true,
      reasoning: true,
      reasoning_options: [{ type: 'toggle' }],
      interleaved: true,
      modalities: { input: ['text', 'image'], output: ['text'] },
      limit: { context: 262144, output: 32768 },
    },
    'kimi-k2.6': {
      id: 'kimi-k2.6',
      name: 'Kimi K2.6',
      family: 'kimi-k2',
      tool_call: true,
      reasoning: true,
      reasoning_options: [{ type: 'toggle' }],
      interleaved: true,
      modalities: { input: ['text', 'image'], output: ['text'] },
      limit: { context: 262144, input: 229376, output: 32768 },
    },
    'kimi-k2.7-code': {
      id: 'kimi-k2.7-code',
      name: 'Kimi K2.7 Code',
      family: 'kimi-k2',
      tool_call: true,
      reasoning: true,
      reasoning_options: [],
      interleaved: true,
      modalities: { input: ['text', 'image', 'video'], output: ['text'] },
      limit: { context: 262144, output: 32768 },
    },
    'kimi-k2.7-code-thinking': {
      id: 'kimi-k2.7-code-thinking',
      name: 'Kimi K2.7 Code (Thinking)',
      family: 'kimi-k2',
      tool_call: true,
      reasoning: true,
      reasoning_options: [],
      interleaved: true,
      modalities: { input: ['text', 'image', 'video'], output: ['text'] },
      limit: { context: 262144, output: 32768 },
    },
    'minimax-m2.5': {
      id: 'minimax-m2.5',
      name: 'MiniMax M2.5',
      family: 'minimax',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text'], output: ['text'] },
      limit: { context: 204800, output: 131072 },
    },
    'minimax-m2.7': {
      id: 'minimax-m2.7',
      name: 'MiniMax M2.7',
      family: 'minimax',
      tool_call: true,
      reasoning: true,
      modalities: { input: ['text'], output: ['text'] },
      limit: { context: 204800, input: 196608, output: 131072 },
    },
    'minimax-m3': {
      id: 'minimax-m3',
      name: 'MiniMax M3',
      family: 'minimax',
      tool_call: true,
      reasoning: true,
      reasoning_options: [{ type: 'toggle' }],
      modalities: { input: ['text', 'image', 'video'], output: ['text'] },
      limit: { context: 1048576, output: 131072 },
    },
  },
};

const deepseekOfficial: ModelsDevProviderEntry = {
  id: DEEPSEEK_PROVIDER_ID,
  models: {
    'deepseek-v4-flash': {
      cost: { input: 0.22, output: 0.66, cache_read: 0.007 },
    },
    'deepseek-v4-pro': {
      cost: { input: 0.66, output: 1.98, cache_read: 0.022 },
    },
    'deepseek-v4-flash-vision-exp': {
      id: 'deepseek-v4-flash-vision-exp',
      name: 'DeepSeek V4 Flash Vision Exp',
      family: 'deepseek-flash',
      tool_call: true,
      reasoning: true,
      reasoning_options: [{ type: 'toggle' }],
      interleaved: { field: 'reasoning_content' },
      modalities: { input: ['text', 'image'], output: ['text'] },
      limit: { context: 1048576, output: 384000 },
      cost: { input: 0.22, output: 0.66, cache_read: 0.007 },
    },
  },
};

const CATALOG_OVERLAYS: ModelsDevCatalog = {
  [KIMI_FOR_CODING_PROVIDER_ID]: kimiForCoding as ModelsDevProviderEntry,
  [MOONSHOTAI_CN_PROVIDER_ID]: moonshotaiCn as ModelsDevProviderEntry,
  [MOONSHOTAI_PROVIDER_ID]: moonshotai as ModelsDevProviderEntry,
  [VOLCENGINE_CODING_PLAN_PROVIDER_ID]: volcengineCodingPlan,
  [DEEPSEEK_PROVIDER_ID]: deepseekOfficial,
};

/** Merge local overlays onto a models.dev catalog snapshot. */
export function mergeCatalogOverlays(base: ModelsDevCatalog): ModelsDevCatalog {
  const merged: ModelsDevCatalog = { ...base };
  for (const [id, overlay] of Object.entries(CATALOG_OVERLAYS)) {
    merged[id] = mergeProviderEntry(merged[id], overlay);
  }
  return merged;
}

function mergeProviderEntry(
  base: ModelsDevProviderEntry | undefined,
  overlay: ModelsDevProviderEntry,
): ModelsDevProviderEntry {
  if (base === undefined) return overlay;
  const models: Record<string, ModelsDevModelEntry> = { ...base.models };
  for (const [modelId, overlayModel] of Object.entries(overlay.models ?? {})) {
    models[modelId] = { ...models[modelId], ...overlayModel };
  }
  return { ...base, ...overlay, models };
}
