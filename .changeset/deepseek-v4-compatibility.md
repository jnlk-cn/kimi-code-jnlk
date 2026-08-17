---
"@moonshot-ai/kimi-code": patch
"@moonshot-ai/agent-core-v2": patch
"@moonshot-ai/kosong": patch
---

Fix DeepSeek V4 and similar OpenAI-compatible reasoners: catalog import marks always-on thinking, per-model output limits above 128k are honored on the wire, and history replay no longer forces `reasoning_effort=medium`. Import with `kimi provider catalog add deepseek`.
