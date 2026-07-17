---
name: ganymede-engineering-bridge
description: Map KimiCodeBoost engineering workflows onto Ganymede Code native UI and host tools (AskUserQuestion, TodoList, Agent, Plans panel, GanymedeBrowser, Worktree, Review).
---

# Ganymede engineering bridge

Use this skill whenever engineering mode (工程模式) is active or a KimiCodeBoost skill is running inside Ganymede Code. Prefer Ganymede-native surfaces over CLI-only or local HTTP helpers.

Engineering mode **silently preloads** this skill (and `using-kimicodeboost`) when the mode is entered. Do not announce that preload, and do not start a turn until the user sends a real message.

## Tool and UI mapping

| KimiCodeBoost concept | Ganymede native capability |
| --- | --- |
| Ask the user / multiple choice | `AskUserQuestion` → Question bar |
| Task tracking / todos | `TodoList` → Composer Todo bar (replace the full list each update) |
| Implementer / reviewer / fixer subagent | `Agent` with `subagent_type: "coder"` (default), `explore`, or `plan` — progress shows in the subagent rail |
| Parallel independent subagents | Prefer `AgentSwarm` (alone in that response). For a persistent swarm posture, switch interaction mode to **集群 (multitask)** |
| Brainstorm visual assistant / local HTTP preview | **`GanymedeBrowser`** (+ optional `GanymedeSites`). Never start the upstream KimiCodeBoost visual-assistant HTTP server |
| Formal implementation plan + Build approval | Switch to **计划 (Plan)** mode; use Plans panel (⌘⇧L) and Build controls after ExitPlanMode |
| Git worktrees | **`GanymedeWorktree`** and/or Composer execution target **Worktree** |
| Code review diffs | Review panel / Git Diff surface; keep `requesting-code-review` checklist |
| Finish branch / open PR | Git Sync page + `GanymedePullRequests` |
| Codebase search / index | `GanymedeCodebaseSearch` and project index status |
| Desktop browser / computer / memory | Existing `ganymede-desktop` skill (`GanymedeBrowser`, `GanymedeComputer`, `GanymedeMemory`, …) |

## Brainstorming flow → Ganymede tools

When `brainstorming` (or any skill that asks the user) is active:

1. **Clarify requirements** — call `AskUserQuestion` once per question (`background: false`). One question, 2–4 options when possible.
2. **Propose 2–3 approaches** — present them as a **single** `AskUserQuestion` with 2–4 options; put the recommended option first with `(Recommended)`.
3. **Task tracking (pre-plan)** — mirror the skill checklist with `TodoList` so the Composer Todo bar stays current **until** a plan file is bound.
4. **Visual prototypes** — use `GanymedeBrowser` (+ optional `GanymedeSites`). Never start a local HTTP visual-assistant server.
5. **Design complete → Plans panel** — after writing `docs/kimicodeboost/specs/*.md`, tell the user to review it in the **Plans panel (⌘⇧L)** (Ganymede opens it automatically on Write). After the user approves the design spec, use `AskUserQuestion` to confirm switching into **计划 (Plan)** mode. Do **not** write an implementation plan or code while still in Engineering mode.

## Design complete → Plan review → Build

1. Write the design spec under `docs/kimicodeboost/specs/` — it appears in the Plans panel as **设计规格** (read-only preview; no Build).
2. User approves the design spec (brainstorming) in the Plans panel / chat.
3. `AskUserQuestion`: switch to **计划 (Plan)** mode?
4. In Plan mode, run `writing-plans`: write **only** the agent plan file (`Plan file:` path). Frontmatter must include `name`, `overview`, `todos[]`. Migrate any current TodoList checklist into those `todos[]`.
5. Call `ExitPlanMode` → Plans panel shows the **实现计划** + Build controls for user review.
6. After Build approval, Ganymede binds that plan file: Composer Todo bar and Plans panel show the **same** frontmatter todos. Keep updating via `TodoList` (host writes back to the plan file). Do not maintain a separate checklist.

## AskUserQuestion

- Prefer 1 question with 2–4 concrete options when possible.
- Put the recommended option first and suffix its label with `(Recommended)`.
- Use `multi_select: true` for multiple answers and `background: true` when you can keep working without the answer.
- **Never** render those choices as plain assistant Markdown (A/B/C lists) unless `AskUserQuestion` is unavailable (for example Auto permission mode denied it).

### Example (scope choice for a snake game)

```json
{
  "name": "AskUserQuestion",
  "arguments": {
    "questions": [
      {
        "question": "Which scope for the snake web game?",
        "header": "Scope",
        "options": [
          {
            "label": "Classic minimal (Recommended)",
            "description": "Move, eat, die on wall/self, score, keyboard only"
          },
          {
            "label": "Medium+",
            "description": "Classic + touch controls, restart, speed scales with score"
          },
          {
            "label": "Full game",
            "description": "Medium + high score, pause, difficulty, sound"
          }
        ],
        "multi_select": false
      }
    ]
  }
}
```

## Agent / AgentSwarm rules

- Do **not** pass `general-purpose` as `subagent_type` — it does not exist.
- For implementation, code review, spec review, quality review: `Agent` with `subagent_type: "coder"` (or omit; coder is default).
- For read-only exploration: `subagent_type: "explore"`.
- For read-only planning / architecture: `subagent_type: "plan"`.
- Keep dependent subagent steps sequential. Use multiple `Agent` calls or `run_in_background: true` only when work is independent.
- When a skill batches many independent items from one template, use `AgentSwarm` as the **only** tool call in that response. `prompt_template` must contain `{{item}}`, with at least 2 `items` (or `resume_agent_ids`).

## Plans vs engineering mode

- Engineering mode loads KimiCodeBoost workflow skills; it does **not** replace Plan mode's permission guard or Build approval UI.
- Design specs under `docs/kimicodeboost/specs/` appear in the Plans panel as **设计规格** for review only (no Build).
- Formal implementation plans for Build **must** be written in Plan mode to the agent plan file — never under `docs/kimicodeboost/plans/` in Ganymede.
- After ExitPlanMode → Build, session todos and plan todos stay unified on that approved plan file.
- Plan Markdown must use YAML frontmatter (`name`, `overview`, `todos[]` with `id` / `content` / `status`).

## Debugging

- For pure troubleshooting with thin evidence, prefer switching to **排障 (Debug)** mode instead of forcing a full feature workflow.
- Debug mode silently preloads `systematic-debugging` and `ganymede-debug-bridge` (probes + Composer verification bar).
- `systematic-debugging` may still apply inside engineering mode when the user is already mid-feature; prefer Debug mode for greenfield incident triage.

## Do not

- Install or treat KimiCodeBoost as a separate plugin — skills are bundled under Ganymede resources.
- Start `.kimicodeboost/brainstorm/` local HTTP servers or `kimi server` / WebBridge for visual brainstorming.
- Bypass skill matching when engineering mode is active: check skills first, then act.
- Render clarifying or scope choices as Markdown A/B/C in the assistant message.
- Pass `general-purpose` as `subagent_type`.
- Announce or re-activate engineering bootstrap skills when the mode is entered — they are already preloaded silently.
