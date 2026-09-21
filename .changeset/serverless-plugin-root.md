---
"@quartal/plugin": patch
---

Resolve the plugin root at runtime instead of trusting the baked build-time path. `getAnonApp` / `getAuthApp` now run the configured `pluginRootFolder` through `Helpers.resolvePluginRoot`: a `QRTL_PLUGIN_ROOT` env var wins, a configured folder is used only when it exists on disk, and otherwise the root falls back to `process.cwd()`. This makes the runtime work on serverless platforms (Vercel, Netlify) that build the app in one directory and run it in another.
