# @moonshot-ai/ganymede-code

## 0.2.0

### Minor Changes

- Add native Skill and plugin command activation, plugin MCP controls, and background Agent task management. Run `/multitask` for parallel execution and `/agents` to monitor it.
- Add element screenshot references, bookmarks, page fitting, zoom controls, and developer tools to the desktop browser. Open the browser panel to use them.
- Add catalog-backed desktop model setup with per-model thinking controls and DeepSeek V4 compatibility. Configure models under Settings → Models & Thinking.
- Add a macOS-native desktop workspace with project and task menus, searchable prompt references, and in-composer mode switching. Use the + menu or type @, /, $, or # in the composer.
- Fix opening the terminal creating two tabs, and add font size/family settings plus clear and copy actions. Configure fonts under Settings → Appearance.
- Add a web development mode that serves the renderer in a browser for Cursor debugging. Run `pnpm dev:web:ganymede` and open the printed localhost URL.

### Patch Changes

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
