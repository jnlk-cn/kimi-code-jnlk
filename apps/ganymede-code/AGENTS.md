# apps/ganymede-code

Electron desktop client for Ganymede Code. The main process embeds
`@moonshot-ai/kimi-code-sdk`; application code must not import
`@moonshot-ai/agent-core` directly.

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
