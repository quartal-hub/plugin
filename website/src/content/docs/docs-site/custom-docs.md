---
title: "Custom docs"
description: "Make the built-in docs site yours: identity and README, a Bootstrap skin, and finally your own landing page."
section: creating
order: 8
---

Every plugin serves a **docs site** at `/`: the About page with your README, the Tools index with
every REST route and MCP tool name, the skills, agents, widgets and prompts, Swagger UI and ReDoc,
and the MCP connection details. It is rendered from the plugin's own metadata, so it is always
complete and always current.

You customize it in three layers, from the lightest to the heaviest. Start at the top: most plugins
never need the last one.

| Layer | What changes | Where |
|---|---|---|
| [Identity](#1-identity-title-description-logo-and-readme) | Title, description, logo, icons, the About page text | `qrtl.config.ts`, `README.md` |
| [Skin](#2-skin-your-bootstrap-css) | Colors, fonts, rounding, spacing, component looks | `style.skin` |
| [Your own landing page](#3-your-own-landing-page) | The page at `/` itself | `src/pages/index.astro` |

## 1. Identity: title, description, logo and README

The About page and the top bar show what `qrtl.config.ts` says about the plugin (see
[Configuration](/docs/reference/configuration) for every option):

```ts
// qrtl.config.ts
import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "PRH Open Data",
  description: "Company register, financial statements and registered notices from PRH.",
  style: {
    logo: "https://cdn.example.com/prh-logo.png",
    icons: [{ src: "https://cdn.example.com/prh-icon.png", mimeType: "image/png", sizes: ["192x192"] }],
  },
});
```

| Option | Shown as |
|---|---|
| `title` | The heading of the About page and the brand text of the top bar. Falls back to `package.json#name`. |
| `description` | The lead paragraph of the About page. Also the MCP server description, so write it for the agent as much as for the reader. |
| `style.logo` | The picture next to the heading on the About page. At least 300 px wide; defaults to the Quartal logo. |
| `style.icons` | The first icon is the top-bar icon; all of them are advertised to MCP clients. Icon bytes are served from `/icons/{index}` on your host, so a client never needs to reach your CDN. |

**README.md** in the plugin root is the body of the About page. It is first-party content, so its
HTML (layout `<div>`s, images under `public/`) is rendered rather than escaped. Write it for the
person deciding whether to connect the plugin: what the tools do, what access they need, an example
conversation. The same file is served raw at `/readme.md`.

## 2. Skin: your Bootstrap CSS

The docs site is built on **Bootstrap 5.3**: every view uses Bootstrap components (`list-group`,
`table`, `badge`, `btn`, `alert`) and Bootstrap utility classes, and nothing else. The look is
therefore one stylesheet, the **skin**, which `style.skin` points at:

```ts
export default defineQrtlConfig({
  style: {
    skin: "https://cdn.example.com/skins/acme.css",
  },
});
```

The server injects the skin as the first stylesheet of the docs page
(`<link id="plugin-docs-web-skin">`), so it loads before the app mounts and nothing flashes. The
default is `https://cdn.quartal.com/skins/default.css`.

### What a skin must contain

A skin is one self-contained CSS file on a CDN or on your own host, with two parts:

1. **Bootstrap 5.3**, compiled with your variables. The docs site relies on the Bootstrap 5.3 class
   names and on the Bootstrap CSS variables (`--bs-primary`, `--bs-body-color`, …); a Bootstrap 4
   build, Tailwind or a bare reset will not style it.
2. **Bootstrap Icons 1.13.1**. The views draw their chevrons, the hint icons on the Tools index and
   the widget check marks with `bi-*` classes, so the icon font must come along, either bundled or
   imported:

   ```css
   @import url("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css");
   ```

   The default skin does exactly this, so copying it is a good starting point.

The usual way to build one is the Bootstrap Sass toolchain: set the variables, import Bootstrap,
add the icons, compile once and publish the file.

```scss
// acme.scss → acme.css
$primary: #1a73e8;
$font-family-sans-serif: "Inter", system-ui, sans-serif;
$border-radius: 0.25rem;

@import "bootstrap/scss/bootstrap";
@import "bootstrap-icons/font/bootstrap-icons.css";
```

### Component overrides

Every component of the docs site carries a root class with a `q-` prefix, so a skin can restyle one
component without touching Bootstrap itself. Use the Bootstrap CSS variables for colors, so the rule
follows the rest of the skin:

```css
.q-plugin-tools-index .table > thead th {
  color: var(--bs-primary);
  text-transform: uppercase;
}
.q-plugin-left-navi .list-group-item.active {
  border-left: 4px solid var(--bs-primary);
}
```

| Root class | Component |
|---|---|
| `q-plugin-about` | The About page: logo, title, summary cards, README |
| `q-plugin-summary` | The summary cards of the About page |
| `q-plugin-left-navi` | The left navigation |
| `q-plugin-login`, `q-plugin-login-error` | The login button and its error alert in the top bar |
| `q-plugin-tools-index` | The Tools index (every tool with its REST route and MCP name) |
| `q-plugin-tool-group` | One class of tools |
| `q-plugin-tool-detail`, `q-plugin-type-doc` | One tool, and the types it uses |
| `q-plugin-prompt-detail` | One MCP prompt |
| `q-plugin-swagger-view`, `q-plugin-redoc-view` | The embedded Swagger UI and ReDoc |

The same skin can serve your [widgets](/docs/widgets/mcp-apps-widgets): they are your own pages,
so link the stylesheet from their layout and the agent's chat shows the plugin's look there too.

## 3. Your own landing page

When the docs site itself is not what you want at `/`, give the plugin a page of its own. Create
`src/pages/index.astro` (or `index.md`, `.mdx`, `.html`, `.ts`, `.js`) in the project and Astro
renders it instead of the docs site. Everything the machines use keeps working unchanged:
`/plugin.json`, `/mcp`, `/api/*`, OAuth, `/skills/*`, `/agents/*` and the generated JSON files all
stay with the plugin runtime. Only `/` and the convenience redirects (`/mcp.html`, `/swagger.html`,
`/docs.html`, `/skills.html`, `/agents.html`) are released to your page.

The page is detected when the server starts, so restart `astro dev` after adding or removing it.

### Keep the docs UI inside your page

The docs site is published as the npm package
[`@quartal/plugin-docs-web`](https://www.npmjs.com/package/@quartal/plugin-docs-web): one ES module
with Vue, the router and the lazy Swagger UI and ReDoc views bundled. Mount it on your page and you
have your own header, navigation and content around the complete docs UI:

```bash
npm install @quartal/plugin-docs-web
```

```astro
---
// src/pages/index.astro
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Acme Plugin</title>
    <link rel="stylesheet" href="https://cdn.example.com/skins/acme.css" />
  </head>
  <body>
    <header class="container py-3">Acme: your own branding and navigation.</header>
    <div id="docs"></div>
    <script>
      import "@quartal/plugin-docs-web/style.css";
      import { mountPluginDocs } from "@quartal/plugin-docs-web";
      mountPluginDocs(document.getElementById("docs")!);
    </script>
  </body>
</html>
```

Two things change when the page is yours:

- **The skin is yours to load.** `style.skin` is injected into the built-in page only; on your own
  page, link the skin in `<head>` as above. It still has to be a Bootstrap 5.3 skin with Bootstrap
  Icons, for the same reasons as in [layer 2](#2-skin-your-bootstrap-css).
- **The docs UI version is yours to choose.** The built-in page always loads the UI published on
  plugin.quartal.com; a mounted one is the package version your plugin installs, so update the
  dependency to pick up new views.

The data the UI shows is fetched from the plugin's own origin (`/com.quartal.plugin/contents.json`
and the other [generated files](/docs/reference/plugin-outputs)), so the mounted UI needs no
configuration.

### Self-hosting the built-in page

For a plugin without an index page of its own, the page at `/` is a copy of the shell published on
plugin.quartal.com, fetched and cached by the server. A deployment can point it elsewhere with the
`QRTL_DOCS_WEB_URL` environment variable, or the `docsWebUrl` option of the integration. That is a
hosting choice, for example an air-gapped network or a pinned UI version, not a way to customize the
page: for that, use the layers above.
