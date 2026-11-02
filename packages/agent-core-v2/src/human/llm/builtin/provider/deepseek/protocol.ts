import type { Message } from '#/llm/message';
import type { LlmModelSpec, ThinkingRequestOptions } from '#/llm/request';
import { openAIProtocol, type OpenAIParams } from '#/llm/builtin/protocol/openai/index';

export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com';

export const DEEPSEEK_V4_MODEL_PREFIX = 'deepseek-v4-';

const DEEPSEEK_FLASH_MODEL = 'deepseek-flash';

const DEEPSEEK_V4_MAX_OUTPUT_TOKENS_CEILING = 384 * 1024;

export function deepSeekBaseModelId(modelName: string): string {
  const slash = modelName.lastIndexOf('/');
  return slash >= 0 ? modelName.slice(slash + 1) : modelName;
}

export function isDeepSeekV4Model(modelName: string): boolean {
  const base = deepSeekBaseModelId(modelName).toLowerCase();
  return base.startsWith(DEEPSEEK_V4_MODEL_PREFIX) || base === DEEPSEEK_FLASH_MODEL;
}

export function isDeepSeekBaseUrl(baseUrl: string | undefined): boolean {
  if (baseUrl === undefined || baseUrl.length === 0) return false;
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === 'deepseek.com' || host.endsWith('.deepseek.com');
  } catch {
    return false;
  }
}

function replaysThinking(messages: readonly Message[]): boolean {
  return messages.some((message) => message.content.some((part) => part.type === 'think'));
}

function reasoningEffortOf(effort: string): string | undefined {
  switch (effort) {
    case 'minimal':
    case 'low':
      return 'low';
    case 'on':
    case 'medium':
    case 'high':
    case 'xhigh':
      return 'high';
    case 'max':
    case 'ultra':
      return 'max';
    default:
      return undefined;
  }
}

function encodeDeepSeekThinking(
  thinking: ThinkingRequestOptions | undefined,
  messages: readonly Message[],
): Partial<OpenAIParams> | undefined {
  if (thinking === undefined) {
    return replaysThinking(messages)
      ? { thinking: { type: 'enabled' }, reasoning_effort: 'high' }
      : undefined;
  }
  if (thinking.effort === 'off') {
    return { thinking: { type: 'disabled' } };
  }
  const effort = reasoningEffortOf(thinking.effort);
  return effort === undefined
    ? { thinking: { type: 'enabled' } }
    : { thinking: { type: 'enabled' }, reasoning_effort: effort };
}

function encodeDeepSeekMaxTokens(cap: number, _model: LlmModelSpec): Partial<OpenAIParams> {
  const capped = Math.max(1, Math.min(cap, DEEPSEEK_V4_MAX_OUTPUT_TOKENS_CEILING));
  return { max_tokens: capped };
}

export const deepseekOpenAIProtocol = openAIProtocol.with((base) => ({
  thinking: (thinking, module) => encodeDeepSeekThinking(thinking, module.content.messages),
  maxOutputTokens: encodeDeepSeekMaxTokens,
  flatten: (native, module) => {
    const request = base.flatten(native, module);
    const params = request.params as Record<string, unknown>;
    const model = params['model'];
    if (typeof model !== 'string' || !isDeepSeekV4Model(model)) return request;
    const baseId = deepSeekBaseModelId(model);
    if (baseId === model) return request;
    return { params: { ...request.params, model: baseId } };
  },
}));
