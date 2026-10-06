---
"@quartal/plugin": minor
"@quartal/plugin-vue": minor
---

Widgets control their theme and display mode. `useExtApps` (and `connectWidget`) take `applyTheme` and
`autoResize` options, so a widget with a fixed brand look can leave the host theme off. The bridge and the
`useExtApps` handle report `displayMode` and `availableDisplayModes` and offer `requestDisplayMode(mode)`, for
example to ask the host for `fullscreen` when a dialog does not fit the inline frame. A host-context change that
carries no theme no longer resets the reported theme to light.

`Helpers.getEnvVar(name, type)` reads typed environment variables (string, number, boolean; `?` makes one
optional), and `astro dev` loads the project's `.env*` files into `process.env` for it.

The default `quartal-hub` issuer is `https://iam2026.test.qrtl.com/auth/realms/quartal` (the realm path
includes `/auth`).
