---
"@moonshot-ai/kimi-code": minor
---

Add the `/context` slash command to switch how much context a model fills before auto-compaction: `128k`, `256k`, `320k`, `512k`, `768k`, or `1m`. Run `/context` to pick a size or `/context 256k` to set one directly; the choice persists as `max_input_size` and takes effect in the running session immediately, except while a turn is streaming.
