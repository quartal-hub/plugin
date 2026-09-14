---
"@quartal/plugin": minor
---

`qrtl.config.ts` is now the single source of plugin configuration. The `qrtlPlugin()` Astro
integration reads the auth mode from `qrtl.config` — the `qrtlPlugin({ auth })` option is
deprecated (it still wins when passed, with a warning) — fails the build when a config file
exists but cannot be loaded instead of silently falling back to anonymous, and watches the config
file so edits restart the dev server. Every `package.json` identity field (`version`, `license`,
`homepage`, `author`, `repository`, `keywords`, in addition to the existing `name` and
`description`) can now also be set in `qrtl.config`, which takes precedence; `package.json` is
the fallback.
