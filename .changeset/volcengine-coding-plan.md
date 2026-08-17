---
"@moonshot-ai/kimi-code": patch
"@moonshot-ai/kosong": patch
"@moonshot-ai/agent-core-v2": patch
---

Add Volcengine Ark Coding Plan to the provider catalog with its Coding Plan endpoint and current model list (including glm-5.2, kimi-k2.7-code, and minimax-m3). Cap per-model `max_output_size` to each model's Volcengine gateway limit so requests no longer fail with invalid `max_tokens`. Import with `kimi provider catalog add volcengine-coding-plan` or `/provider`.
