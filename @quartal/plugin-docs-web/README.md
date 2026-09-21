# @quartal/plugin-docs-web

The Vue SPA library for Quartal plugin documentation (API / MCP / Skills / Widgets overview).
Its `build` produces a self-contained ES library (`dist/plugin-docs-web.js` + `.css`, with lazy
Swagger/ReDoc chunks) whose `mountPluginDocs(el)` the website's `/plugin-index` page calls. Every
deployed plugin fetches that page's HTML at runtime and serves it at `/` (see `docsShell.ts` in
`@quartal/plugin`), so the SPA runs on the plugin's origin while its assets load from the website.

## Propagation chain

```
@quartal/ui-plugin/src   (PluginLeftNavi, PluginAbout, PluginToolDetail, … — aliased to SOURCE by vite.config.ts)
        │
        ▼
@quartal/plugin-docs-web   (this library; `pnpm build` → dist/)
        │  imported by website/src/pages/plugin-index.astro
        ▼
https://plugin.quartal.com/plugin-index/   (published by deploy-website.yml on merge to main)
        │  fetched + rewritten by @quartal/plugin's docsShell.ts
        ▼
every deployed plugin's `/`
```

Because `vite.config.ts` aliases `@quartal/ui-plugin` to `../ui-plugin/src`, **editing a `ui-plugin` component
needs no separate `ui-plugin` build** — just rebuild this library.

## Ship a docs UI change

Merge to `main`: the website workflow rebuilds and republishes `/plugin-index`, and every deployed
plugin picks it up as its shell cache expires (1 hour) or on restart — no plugin redeploys needed.

To preview against a local plugin before merging:

```bash
pnpm --filter @quartal/plugin-docs-web build
pnpm --filter @quartal/website dev            # serves /plugin-index on :4321
QRTL_DOCS_WEB_URL=http://localhost:4321/plugin-index/  # set for the plugin's server
```

## Develop the SPA standalone

`pnpm --filter @quartal/plugin-docs-web dev` serves it on :5173 and proxies `/plugin.json`, `/com.quartal.plugin`, `/api`, `/mcp`,
… plus plugin `public/` static files (e.g. README `/screen-shots/*.png`) to a running plugin
(default `http://localhost:4321` which is Astro default; override with `VITE_HUB_API_PROXY`).

> `vue-tsc` type-checking is `pnpm --filter @quartal/plugin-docs-web typecheck` (kept out of `build`; it
> currently reports pre-existing prop-typing issues in some `ui-plugin` components).
