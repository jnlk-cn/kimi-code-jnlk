---
name: ganymede-desktop
description: Use Ganymede Code desktop capabilities such as the built-in browser, macOS Computer Use, local memory, scheduled tasks, Sites, and pull requests.
---

# Ganymede desktop tools

- Prefer `GanymedeBrowser` for localhost and public page previews. Inspect the page before clicking, and capture a screenshot after visual changes.
- Use `GanymedeChrome` only when the user needs an already signed-in Chrome profile and has connected the extension.
- Use `GanymedeComputer` only for a named app or concrete GUI flow. Request permissions first, keep the scope narrow, and stop if the visible target is ambiguous.
- Save with `GanymedeMemory` only when the user asks to remember something or the information is a durable project convention. Never save credentials.
- Use `GanymedeSchedule` for local recurring work. Prefer an isolated worktree for unattended code changes.
- Register generated interactive artifacts with `GanymedeSites`, then serve and verify them through `GanymedeBrowser`.
- Use `GanymedePullRequests` to load PR context through the authenticated `gh` CLI.
---
name: ganymede-desktop
description: Use Ganymede Code desktop capabilities such as the built-in browser, macOS Computer Use, local memory, scheduled tasks, Sites, and pull requests.
---

# Ganymede desktop tools

- Prefer `GanymedeBrowser` for localhost and public page previews. Inspect the
  page before clicking, and capture a screenshot after visual changes.
- Use `GanymedeChrome` only when the user needs an already signed-in Chrome
  profile and has connected the extension.
- Use `GanymedeComputer` only for a named app or concrete GUI flow. Request
  permissions first, keep the scope narrow, and stop if the visible target is
  ambiguous.
- Save with `GanymedeMemory` only when the user asks to remember something or
  the information is a durable project convention. Never save credentials.
- Use `GanymedeSchedule` for local recurring work. Prefer an isolated worktree
  for unattended code changes.
- Register generated interactive artifacts with `GanymedeSites`, then serve and
  verify them through `GanymedeBrowser`.
- Use `GanymedePullRequests` to load PR context through the authenticated `gh`
  CLI.
