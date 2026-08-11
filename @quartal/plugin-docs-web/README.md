# @quartal/plugin-docs-web

The Vue SPA for Quartal plugin documentation (API / MCP / Skills / Widgets overview). A pnpm workspace
package. Its `build` **builds and vendors** the SPA into `@quartal/plugin/static/plugin-docs-web`, which the
hub serves from the plugin's `/` route (from the generated `contents.json`). Node only — no Deno.

## Propagation chain

```
@quartal/ui-plugin/src   (PluginLeftNavi, PluginAbout, PluginToolDetail, … — aliased to SOURCE by vite.config.ts)
        │
        ▼
@quartal/plugin-docs-web   (this SPA; `pnpm build` → dist/ → vendored)
        │  scripts/vendor-to-plugin.mjs (runs at the tail of build)
        ▼
@quartal/plugin/static/plugin-docs-web   (served by the hub docs-SPA route)
```

Because `vite.config.ts` aliases `@quartal/ui-plugin` to `../ui-plugin/src`, **editing a `ui-plugin` component
needs no separate `ui-plugin` build** — just rebuild this SPA.

## Update the served docs SPA after a ui-plugin (or SPA) change

```bash
pnpm --filter @quartal/plugin-docs-web build   # = vite build + vendor → @quartal/plugin/static/plugin-docs-web
```

Then rebuild the hub / restart the consuming plugin's dev server to pick up the new SPA.

## Develop the SPA standalone

`pnpm --filter @quartal/plugin-docs-web dev` serves it on :5173 and proxies `/plugin.json`, `/api`, `/mcp`,
… plus plugin `public/` static files (e.g. README `/screen-shots/*.png`) to a running plugin
(default `http://localhost:4321` which is Astro default; override with `VITE_HUB_API_PROXY`).

> `vue-tsc` type-checking is `pnpm --filter @quartal/plugin-docs-web typecheck` (kept out of `build`; it
> currently reports pre-existing prop-typing issues in some `ui-plugin` components).
