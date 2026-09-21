# @quartal/plugin-docs-web

The docs UI for Quartal Plugins (tools / MCP servers / skills / agents / widgets / API overview)
as an embeddable library. A self-contained ES module — Vue, the router, and the lazy Swagger /
ReDoc views are bundled; installing it adds no other dependencies.

Every Quartal Plugin serves this UI at `/` out of the box (fetched from the published shell on
plugin.quartal.com — see `docsShell.ts` in `@quartal/plugin`). Install the package only when you
want to *host the UI yourself*, most commonly from your own landing page.

## Use it from your own `index.astro`

Creating `src/pages/index.astro` in a plugin project replaces the built-in docs page entirely
(see the [HTTP endpoints reference](https://plugin.quartal.com/docs/reference/http-endpoints)).
If you still want the docs UI available — under your own branding, alongside your own content —
mount it yourself:

```bash
npm install @quartal/plugin-docs-web
```

```astro
---
// src/pages/index.astro — your landing page, docs UI included.
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Plugin</title>
    <link rel="stylesheet" id="plugin-docs-web-skin" href="https://cdn.quartal.com/skins/default.css" />
  </head>
  <body>
    <header>My own branding, navigation, anything.</header>
    <div id="docs"></div>
    <script>
      import "@quartal/plugin-docs-web/style.css";
      import { mountPluginDocs } from "@quartal/plugin-docs-web";
      mountPluginDocs(document.getElementById("docs")!);
    </script>
  </body>
</html>
```

Notes:

- The app reads all plugin data (`/plugin.json`, `/open-api.json`, skills, agents, …) from the
  **document origin**, so the page must be served by the plugin itself — which an `index.astro`
  in your plugin project is. It cannot run on an unrelated origin without CORS.
- The skin `<link>` is optional: swap the `href` for your own Bootstrap-based skin. The
  `id="plugin-docs-web-skin"` marker only matters on the built-in page (the plugin injects the
  `qrtl.config` `style.skin` there); on your own page you control the stylesheet directly.
- Routing is hash-based (`/#/mcp`, `/#/skills`, …), so it works from any path — the page does not
  have to be the site root.
- The OAuth docs-login flow (`auth: "quartal-hub"` / `"custom"` plugins) works unchanged: the
  library captures the `/oauth/callback` fragment on the page it is mounted on.

## How the built-in docs page uses this package

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

## Ship a docs UI change (maintainers)

Merge to `main`: the website workflow rebuilds and republishes `/plugin-index`, and every deployed
plugin picks it up as its shell cache expires (1 hour) or on restart — no plugin redeploys needed.
Publishing the npm package (changesets, like the other `@quartal/*` packages) is only needed for
consumers who mount the UI themselves.

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
