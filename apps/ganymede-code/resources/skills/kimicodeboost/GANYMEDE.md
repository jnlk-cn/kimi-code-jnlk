# Ganymede patches for vendored KimiCodeBoost skills

Upstream pin: `jnlk-cn/KimiCodeBoost@v6.0.3`.

After running `pnpm sync:kimicodeboost`, re-apply these local edits:

- `brainstorming/SKILL.md` — visual assistant → GanymedeBrowser (do not start the
  upstream local HTTP visual-assistant server); clarifying questions and approach
  choices MUST use `AskUserQuestion` (no Markdown A/B/C); add Ganymede HARD-GATE;
  after design approval, AskUserQuestion to enter Plan mode before writing-plans
- `using-kimicodeboost/SKILL.md` — engineering mode silently preloads this skill
  and `ganymede-engineering-bridge`; do not reply or busy the agent before the
  first real user message
- `writing-plans/SKILL.md` — Ganymede HARD-GATE: Plan mode only; write only the
  agent plan file (`agents/main/plans/{id}.md`) with YAML frontmatter; call
  ExitPlanMode; never use `docs/kimicodeboost/plans/` for formal review
- `executing-plans/SKILL.md` — after Build, update todos only via TodoList so the
  host can sync into the approved plan file (no separate checklist)

Durable host-tool mapping lives in `../ganymede-engineering-bridge/SKILL.md`.
