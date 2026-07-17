# apps/ganymede-code

Electron desktop client for Ganymede Code (`@jnlk.zone/ganymede-code`). The main
process embeds `@moonshot-ai/kimi-code-sdk`; application code must not import
`@moonshot-ai/agent-core` directly.

- Runtime data root is `GANYMEDE_HOME` (default `~/.ganymede`). Project-local
  brand config lives under `.ganymede/` (`local.toml`, `mcp.json`, `skills/`,
  `AGENTS.md`). Do not read or write Kimi CLI's `.kimi-code` paths.
- Keep privileged filesystem, process, Git, browser, and SDK access in the main
  process. The renderer may only use the typed preload bridge (or the web-dev
  `DesktopApi` shim that talks to the local HTTP/SSE bridge).
- `dev:web` (`GANYMEDE_WEB_DEV=1`) runs a headless Electron main for browser
  UI debugging. Keep the bridge on `127.0.0.1` only; do not turn it into a
  public web product surface.
- Remote web content belongs in `WebContentsView`, never in the application
  renderer.
- Approval, question, and destructive Git flows fail closed when their UI
  counterpart disconnects.
- Keep product-facing copy under the Ganymede Code / 伽利略 Code brand. Kimi
  names may appear only when identifying the underlying model provider.

## Desktop UI Design System

Follow a Codex-like, content-first desktop visual language: quiet chrome,
compact native controls, restrained color, and clear hierarchy. Do not copy
another product's branding; apply these interaction principles consistently to
Ganymede.

### Selection and emphasis

- Rounded navigation items, icon buttons, menu rows, segmented controls, tabs,
  task rows, tree rows, and toolbar buttons MUST use neutral selected states.
  Derive their background, border, foreground, and optional edge indicator from
  `--text`, `--surface-*`, and the shared `--selection-*` tokens.
- NEVER use `--accent`, `--accent-rgb`, an accent-tinted fill, accent border,
  accent icon, glow, or accent underline merely to show that a rounded control
  is selected, checked, pressed, or active.
- Reserve the accent color for keyboard focus rings, text links, unread marks,
  progress/running feedback, semantic data, and the single primary action in a
  region. Destructive actions use `--danger`; success and warning colors remain
  semantic rather than decorative.
- A selected control should normally have one dominant signal: a neutral fill.
  Add a neutral edge marker only when spatial orientation benefits, such as a
  file tree. Do not stack colored fill, colored border, colored
  icon, glow, and shadow on one state.

### Interaction states

- Use the shared tokens from `components/codex-interaction.css`. Keep hover
  lighter than selected-hover, keep selected text high contrast, and avoid
  geometry changes between rest, hover, focus, and selected states.
- Keyboard focus must remain clearly visible and may use the accent color; focus
  and selection are separate states and must not be styled as the same thing.
- Press feedback may use a subtle scale or darker neutral surface for 120–160ms.
  Respect `prefers-reduced-motion` and never rely on motion alone to convey state.
- Disabled controls keep their layout and use reduced contrast. Do not replace
  disabled state with accent color or hide the control unless the whole action
  is contextually irrelevant.

### Shape, density, and hierarchy

- Prefer 6–8px radii for compact controls and 9–12px for containers. Use pill
  shapes only for tags, statuses, filters, or values whose shape carries meaning.
- Keep desktop chrome dense and aligned to a consistent grid. Prefer spacing,
  typography, dividers, and neutral surfaces over decorative color blocks.
- Avoid decorative colored icon tiles in routine navigation. Use color only when
  it communicates action priority, status, or data meaning.
- Allow at most one visually primary filled action in a local action group. All
  neighboring actions should be neutral secondary or quiet icon controls.

### Implementation and review

- `components/codex-interaction.css` is the final interaction-state layer and
  must remain imported after component styles. Extend its tokens/selectors
  instead of creating one-off accent selected states in feature CSS.
- New UI must support light, dark, and system themes through semantic tokens;
  do not hardcode selected-state colors for one theme.
- Visually verify substantial UI changes at 1440×900, 1200×800, and 900×700.
  Cover keyboard focus, hover, active/selected, disabled, long labels, and empty
  content. A functional test pass is not a substitute for visual review.
