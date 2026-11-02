---
"@moonshot-ai/kimi-code": minor
---

Add Ask and Debug modes. Ask mode answers questions read-only — file edits, shell commands, and subagents are rejected — while Debug mode requires reproducing the failure and gathering evidence before fixing. Switch with Shift-Tab, `/ask`, `/debug`, `/mode`, or `--mode <mode>`. Shift-Tab now cycles Agent → Plan → Ask → Debug instead of toggling Plan mode; `/plan off` still turns Plan mode off directly.
