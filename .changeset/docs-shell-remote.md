---
"@quartal/plugin": minor
---

Docs UI from the published shell, and `src/pages/index.*` overrides it.

The docs page at `/` is no longer served from files vendored inside this package. Instead the
runtime fetches the chrome-less shell page published on the Quartal Plugins website
(`https://plugin.quartal.com/plugin-index/` by default), rewrites its asset URLs to the shell's
origin, injects the plugin's skin, and serves the result from the plugin's own origin — so the
SPA's data fetches and the OAuth login flow stay same-origin while no docs assets ship with the
plugin (the npm package shrinks by ~5 MB, and the `createRequire().resolve()` lookup that crashed
edge runtimes is gone). The shell is cached in memory with a 1-hour TTL, a failed re-fetch falls
back to the cached copy, and an unreachable shell fails soft (503 on the docs page only — API and
MCP are unaffected). Override the URL with the `QRTL_DOCS_WEB_URL` env var (self-hosted copies,
the local website dev server, `file:` fixtures in tests) or `PluginAppConfig.docsWebUrl`.

A plugin can now also ship its own landing page: when `src/pages/index.*` exists, Astro renders it
at `/` (the docs shell and the legacy `.html` redirects are released to Astro), while the machine
routes (`/plugin.json`, `/mcp`, `/api/*`, OAuth, skills/agents) always stay served. Detected at
config time — restart the dev server after adding or removing the page.

`/assets/*` is no longer claimed by the plugin server: docs assets load from the shell's origin,
and a plugin's own `public/assets/` files are served by Astro like any other static assets.
