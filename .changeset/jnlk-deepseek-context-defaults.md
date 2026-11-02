---
"@moonshot-ai/kimi-code": patch
---

Import DeepSeek models with a 256K working budget instead of letting them fill the declared 1M window, so auto-compaction happens earlier. Run `/context 1m`, or set `max_input_size`, to restore the previous behavior.
