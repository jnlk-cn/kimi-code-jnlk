import type { LlmEndpoint } from '#/llm/request';
import { createRequester } from '#/llm/requester';

import { DEEPSEEK_DEFAULT_BASE_URL, deepseekOpenAIProtocol } from './protocol';

export {
  DEEPSEEK_DEFAULT_BASE_URL,
  DEEPSEEK_V4_MODEL_PREFIX,
  deepSeekBaseModelId,
  deepseekOpenAIProtocol,
  isDeepSeekV4Model,
} from './protocol';

const deepseekEndpoint: LlmEndpoint = {
  defaultBaseUrl: DEEPSEEK_DEFAULT_BASE_URL,
};

export const deepseekRequester = createRequester().with({
  protocol: { base: deepseekOpenAIProtocol },
  endpoint: deepseekEndpoint,
});

export const deepseekRequesters = {
  openai: deepseekRequester,
} as const;
