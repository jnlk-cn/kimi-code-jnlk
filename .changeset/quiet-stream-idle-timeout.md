---
"@moonshot-ai/kimi-code": patch
"@moonshot-ai/kimi-code-sdk": patch
---

Stop a stalled model stream from leaving a turn waiting forever: a streaming request that receives no output for two minutes now fails as a retryable timeout instead of hanging. Set `KIMI_CODE_LLM_STREAM_IDLE_TIMEOUT_MS` to change the limit, or to `0` to disable it.
