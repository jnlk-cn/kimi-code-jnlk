---
name: ganymede-debug-bridge
description: Map systematic debugging onto Ganymede Code native Debug / 排障 surfaces (probes, user verification bar, TodoList).
---

# Ganymede debug bridge

Use this skill whenever **排障 (Debug)** mode is active. Prefer Ganymede-native surfaces over plain Markdown checklists.

Debug mode **silently preloads** this skill (and `systematic-debugging`) when the mode is entered. Do not announce that preload, and do not start a turn until the user sends a real message.

## Tool and UI mapping

| Debugging concept | Ganymede native capability |
| --- | --- |
| Four-phase root-cause investigation | Follow `systematic-debugging` strictly |
| Register temporary instrumentation | `GanymedeDebugProbe` (`register` / `list` / `unregister`) |
| Ask the user to manually verify a fix | `GanymedeRequestDebugVerification` → Composer verification bar |
| Investigation checklist | `TodoList` → Composer Todo bar |
| Clarify symptoms / repro steps | `AskUserQuestion` → Question bar |

## Required workflow

1. **Evidence first** — reproduce, read errors, check recent diffs. Do **not** jump to speculative business-logic edits when evidence is thin.
2. **Instrument before guessing** — when you need runtime proof, add temporary logs/asserts tagged with a unique marker (`// ganymede-debug-probe:<id>` or equivalent), then call `GanymedeDebugProbe` with `action: "register"` (file, label, marker; line optional).
3. **Fix only after a confirmed hypothesis** — smallest change that addresses the root cause.
4. **Always request user verification after a fix** — call `GanymedeRequestDebugVerification` with numbered `steps` (1–8) the user can follow, plus an optional `hypothesis`. The tool blocks until the user answers in the Composer bar.
5. **If outcome is `fixed`** — manually remove every registered probe from source (StrReplace / Edit by marker), then `GanymedeDebugProbe` `unregister` (or unregister each id). Do not leave temporary instrumentation behind.
6. **If outcome is `not_fixed`** — read `userNotes` and `registeredProbes`, gather more evidence (including probe output), and return to investigation. Do **not** stack another speculative fix without new evidence.

### Probe marker convention

```ts
// ganymede-debug-probe:abc123
console.log('[ganymede-debug-probe:abc123]', { phase: 'enter', value });
```

Register the same `marker` string via `GanymedeDebugProbe` so cleanup and the verification bar stay in sync.

### Example: request verification

```json
{
  "name": "GanymedeRequestDebugVerification",
  "arguments": {
    "hypothesis": "Null workspace path skipped project load after the recent settings change.",
    "steps": [
      "Reload the app with the same project open.",
      "Confirm the project name appears in the top bar.",
      "Send a short message and wait for a reply.",
      "If anything still fails, note the exact UI text or console error."
    ]
  }
}
```

## Do not

- Claim the bug is fixed before `GanymedeRequestDebugVerification` returns `fixed`.
- Auto-delete user code yourself outside of removing the markers you registered.
- Announce or re-activate debug bootstrap skills when the mode is entered — they are already preloaded silently.
- Skip `systematic-debugging` phase 1 when under time pressure.
