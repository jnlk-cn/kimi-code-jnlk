# @jnlk.zone/ganymede-code

## 0.2.0

### Minor Changes

- Add a Debug / 排障 verification workflow: silently preload systematic-debugging skills, register temporary probes, and show numbered verification steps above the composer with “问题已修复 / 问题未修复”. Switch via `/debug` or the mode menu after a fix.
- After Engineering-mode design approval, route formal plan review through Plan mode and the Plans panel; after Build, keep Composer todos synced with the approved plan file. Switch to Plan mode, then press Build when ExitPlanMode is ready.
- Silently preload Engineering-mode workflow skills on mode switch so the agent stays idle until the user sends a message, and steer clarifying choices through AskUserQuestion instead of Markdown A/B/C. Switch via the mode menu or `/engineering`.
- Add Engineering mode with bundled KimiCodeBoost workflow skills mapped to native Ganymede Plans, Question, Todo, Browser, and Worktree surfaces. Switch via the mode menu or `/engineering`.
- Align Agent-mode composer UX with Cursor: mode-specific placeholders, Shift+Tab over the core five modes (Engineering stays menu/`/engineering` only), and Cmd+./Ctrl+. to open the mode menu. Focus the composer and press Shift+Tab or Cmd+./Ctrl+. to try it.
- Add a Cursor-style inline Questions bar (Skip/Continue per question, Other free text) and queue composer follow-ups while a turn is running. Enter queues; ⌘↵ / Ctrl↵ steers immediately.
- Replace plan approval with a Cursor-style model picker and split Build control in the composer and Plans panel. When ExitPlanMode is ready, pick a model and press Build (⌘↵ / Ctrl↵).
- Show a per-turn file-edit summary above the composer and a Codex-style right-side turn catalog on the timeline. After a turn that edits files finishes, review or revert those paths from the summary card; the active marker elongates with the scroll position and shows a turn preview card.
- Add a Plans side panel that lists every plan created for the open project, keep a single compact timeline hint, open plan files in the panel with YAML frontmatter todos, and render Mermaid diagrams. Open Plans from the right dock (⌘⇧L) after creating a plan in Plan mode.
- Expand external editor detection to about 30 IDEs (full JetBrains suite, Android Studio, Xcode, VSCodium, and more) and show built-in brand icons in the top-bar editor control. Open a project and use the editor split button next to the ready state.
- Complete the sidebar utility pages: live Inbox with unread badges, editable Scheduled tasks, Local Sites management, agent PR feedback fixes, Memory tags/search scopes, and a Skills & Plugins marketplace. Open 更多功能 or run `/inbox`, `/scheduled`, `/sites`, `/pulls`, `/memory`, or `/skills`.
- Add a local project index with path, full-text, and on-device semantic search for @codebase mentions and Agent codebase search. Open a project, then use @codebase or Settings → Project Index.
- Align Plan mode with a Cursor-style review flow: Markdown plan cards, a dedicated Build approval dialog, Shift+Tab mode cycling, and a collapsible Todo bar above the composer. Switch to Plan mode, then approve with Build when ExitPlanMode is ready.
- Upgrade the Review panel into a full Git workflow: per-file diffs (including untracked files), stage/unstage filtering, syntax-highlighted diffs, discard changes, and fetch/pull/push with branch switching. Open Review on a Git project to try it.
- Fix the composer permission control so Manual/Auto/YOLO work before a session exists, align labels with the CLI, and add `/permission`, `/auto`, `/yolo`, `/mode`, `/model`, `/plan`, `/compact`, `/status`, and `/usage`. Use the permission button or type `/auto` in the composer.
- Show a context-usage ring next to the model label in the composer; click it for a categorized token breakdown. Open a session and click the ring beside the model name.
- Align multitask/swarm mode with the CLI: AgentSwarm progress grid, /swarm commands, Manual permission prompt, and timeline filtering. Run /swarm or /multitask, then open /agents for background tasks.
- Add syntax-highlighted code views with line numbers, HTML preview in the built-in browser, and one-click IDE shortcuts in the top bar. Open Files or a Write tool block to try highlighting and preview; use the IDE buttons next to the ready state to open the project.
- Show a clear empty state for non-Git workspaces in Review and Pull Requests, with a one-click Initialize Git repository action. Open Review on a plain folder to try it.
- Show DeepSeek balance, estimated session cost, and peak pricing in the task summary panel. Open the summary panel while using the official DeepSeek API.
- Add native Skill and plugin command activation, plugin MCP controls, and background Agent task management. Run `/multitask` for parallel execution and `/agents` to monitor it.
- Add element screenshot references, bookmarks, page fitting, zoom controls, and developer tools to the desktop browser. Open the browser panel to use them.
- Add catalog-backed desktop model setup with per-model thinking controls and DeepSeek V4 compatibility. Configure models under Settings → Models & Thinking.
- Add a macOS-native desktop workspace with project and task menus, searchable prompt references, and in-composer mode switching. Use the + menu or type @, /, $, or # in the composer.
- Fix opening the terminal creating two tabs, and add font size/family settings plus clear and copy actions. Configure fonts under Settings → Appearance.
- Add a web development mode that serves the renderer in a browser for Cursor debugging. Run `pnpm dev:web:ganymede` and open the printed localhost URL.

### Patch Changes

- Fix startup recovery so missing desktop bridge and early renderer errors show a stable reload screen, and restore clean TypeScript builds.
- Keep long sessions, streaming output, panel transitions, and resizing responsive with frame-batched rendering and lightweight motion.
- Render GFM tables, task lists, images, code, and viewport-lazy Mermaid diagrams with polished transcript styling.
- Fade streamed assistant and thinking text in smoothly without a trailing cursor in the timeline.
- Fix chat auto-layout so the timeline and composer share one flex column, with a floating turn catalog that no longer shrinks the message column.
- Hide the streaming accent cursor in Plan mode even before a plan file exists, showing a quiet writing hint instead.
- Move plan approval into an inline bar above the composer so the Plans panel stays readable without a full-screen modal.
- Remove background blur from modals and the command palette so overlays use a solid dimmed backdrop.
- Warn before indexing home directories or oversized folders, allow canceling an in-progress index, and stop indexing immediately when Project Index is disabled. Open a large folder or use Settings → Project Index.
- Refine the workspace tool dock and desktop interaction styling with neutral selection states, responsive drawers, and more efficient long task-history browsing while preserving the established project sidebar design.
- Replace the desktop sidebar branding with the latest Ganymede lockup.
- Use the native macOS sidebar material and keep its appearance synchronized with the selected system theme.
- Fix missing vertical scrollbars in the sidebar, side panels, modals, empty home view, and app menus when content overflows.
- Debounce settings text fields so typing no longer jumps the page, and quote spaced font names like MesloLGS NF so the terminal can apply them.
- Refresh the desktop workspace with a compact project sidebar, centered task composer, bottom terminal, and docked review and browser panels.
- Updated dependencies [7bd29ab]
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @moonshot-ai/kimi-code-sdk@0.14.0
