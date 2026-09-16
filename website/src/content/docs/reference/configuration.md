---
title: "Configuration"
description: "Every qrtl.config.ts option, the package.json fallbacks, and the qrtlPlugin() Astro integration options."
section: reference
order: 2
---

A plugin is configured in one file: **`qrtl.config.ts`** in the project root. It holds everything
about the plugin itself — identity, visual style, auth mode, MCP servers, widget security and the
deploy target. The two other files play supporting roles:

- **`package.json`** — the npm manifest. Every identity field (name, version, description, …) is
  read from here **unless `qrtl.config.ts` sets it**: `qrtl.config.ts` takes precedence,
  `package.json` is the fallback.
- **`astro.config.mjs`** — Astro-host setup only: the `qrtlPlugin()` integration,
  `output: "server"` and an adapter. It contains nothing plugin-specific.

## `qrtl.config.ts`

Author the config with a typed `defineQrtlConfig({...})` default export:

```ts
import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "My Plugin",
  description: "What the plugin does, in one sentence.",
  style: {
    logo: "https://cdn.example.com/logo.png",
    icons: [{ src: "https://cdn.example.com/icon.png", mimeType: "image/png", sizes: ["128x128"] }],
  },
  auth: "quartal-hub",
  deploy: { org: "my-org", app: "my-plugin" },
});
```

The same options can also be written as `qrtl.config.json` (plain JSON, no `defineQrtlConfig`
wrapper), or as `qrtl.config.mjs` / `qrtl.config.js`. The first file found wins, in that order:
`.json`, `.ts`, `.mjs`, `.js`. A config file that exists but fails to parse or import aborts the
build with an error — fix the file rather than expecting defaults.

### Identity

Every field in this group falls back to the `package.json` field of the same name.

| Option | Type | Purpose (and default) |
|---|---|---|
| `name` | `string` | Identifying plugin name, e.g. `@my-org/my-plugin` (`package.json#name`). |
| `title` | `string` | End-user-friendly title shown in docs and MCP clients (derived from the name). |
| `description` | `string` | Short description (`package.json#description`). |
| `version` | `string` | Plugin version (`package.json#version`). |
| `license` | `string` | License identifier, e.g. `MIT` (`package.json#license`). |
| `homepage` | `string` | Primary public URL (`package.json#homepage`). |
| `author` | `string` or object | npm's string shorthand `"Name <email> (url)"` or `{ name, email?, url? }` (`package.json#author`). |
| `repository` | `string` or object | Repository URL, or `{ type?, url, directory? }` — `directory` is the plugin's folder inside a monorepo (`package.json#repository`). |
| `keywords` | `string[]` | Search keywords (`package.json#keywords`). |

### `style`

Visual elements for the built-in docs site and plugin listings.

| Option | Type | Purpose |
|---|---|---|
| `style.logo` | `string` | Logo URL for the docs front page (at least 300px wide). Defaults to the Quartal logo. |
| `style.skin` | `string` | Bootstrap skin CSS URL (CDN), injected into the docs site shell. |
| `style.icons` | array | Icons in the MCP icon schema: `{ src, mimeType?, sizes?, theme? }`. Icon bytes are served from `/icons/{index}` on the plugin's own host. |

### `auth`

The authentication mode of the whole plugin — it selects how the server app is built, for both
the REST API and the MCP server:

- **`"anon"`** (default) — no authentication.
- **`"quartal-hub"`** — OAuth2 / OIDC JWT bearer authentication via Quartal Hub, zero-config
  (fixed test-environment scope, audience and issuer; only `OAUTH_ISSUER` is overridable).
  Tools receive a `QuartalPluginContext` as their second parameter.
- **`"custom"`** — the same JWT bearer authentication against your own OAuth2 / OIDC server
  (Auth0, Microsoft Entra ID, Keycloak, …), configured entirely with environment variables:
  `OAUTH_ISSUER` (required), `OAUTH_AUDIENCE` / `OAUTH_RESOURCE` (at least one), `OAUTH_SCOPE`,
  `OAUTH_JWKS_URI`, `OAUTH_TOKEN_URL`, `OAUTH_CLIENT_ID`.

Widget pages and their assets stay unauthenticated (the sandboxed widget iframe carries
no credentials); auth is enforced on `/api/*` and `/mcp`. See
[Authentication](/docs/auth/authentication/) for the full reference including Auth0 and
Microsoft Entra ID recipes.

Changing `auth` requires a dev-server restart in `astro dev` — the config file is watched, so the
restart happens automatically when you save it.

### `mcp`

MCP server options. Omit it entirely for the default: one MCP server at `/mcp` exposing every
tool. Set `mcp: false` to disable the MCP server.

| Option | Type | Purpose |
|---|---|---|
| `mcp.name` | `string` | MCP server name override. Defaults to the last segment of the plugin name, e.g. `my-plugin` for `@my-org/my-plugin`. |
| `mcp.servers` | record | Named MCP servers (multi-server mode), keyed by server name (`[a-z0-9_-]+`). |

Each entry in `mcp.servers` is one server:

| Option | Type | Purpose |
|---|---|---|
| `servers.<name>.tools` | `string[]` | Tool class names (from `src/tools/`) this server exposes. Omitted on a local server = all tool classes. Not allowed together with `external`. |
| `servers.<name>.external` | object | Declares the server as external: `{ url, headers? }`. It is only emitted into the generated `mcp.json`; clients connect to the URL directly. Mutually exclusive with `tools`. |
| `servers.<name>.description` | `string` | What the server exposes (shown in the plugin overview and docs). |

In multi-server mode each local server is mounted at `/mcp/<name>`; the server named `main` is
also served at `/mcp`. Prompts are served on `main` (or the first local server); each widget is
served by the server that owns its tool.

### `deploy`

Deployment target metadata used by deploy tooling: `{ org?: string, app?: string }` — the Quartal
Hub organization and application the plugin publishes to.

### `widgets`

Content Security Policy for the sandboxed widget iframes, plus per-widget display names.

| Option | Type | Purpose |
|---|---|---|
| `widgets.csp` | object | CSP applied to every widget (see the domain lists below). |
| `widgets.entries` | record | Per-widget overrides keyed by tool id: `{ name?, csp? }`. |

A CSP object lists the external domains a widget may use:

| Field | CSP directive |
|---|---|
| `connectDomains` | `connect-src` (fetch, WebSocket, …) |
| `resourceDomains` | scripts, styles, images and other subresources |
| `frameDomains` | `frame-src` (nested iframes) |
| `baseUriDomains` | document base URIs |

## `astro.config.mjs`

In Astro config, you need to define `qrtlPlugin`as integration, on-demand rendering (`output: "server"`) and an adapter:

```js
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import qrtlPlugin from "@quartal/plugin/astro";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [qrtlPlugin()],
});
```

`qrtlPlugin()` options:

| Option | Type | Purpose |
|---|---|---|
| `devToolbar` | `boolean` | Show the Astro dev toolbar in `astro dev`. We hide it by default because typically is just on the way when debugging widgets inside MCPJam etc. |
