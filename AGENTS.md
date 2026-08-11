# Agent instructions

## Repo

This is [`quartal-hub/plugin`](https://github.com/quartal-hub/plugin) — the **public, open-source
(MIT) home of Quartal Plugins**: packaged business functionality for AI agents (Tools, Widgets,
Agent Skills — Agents are on the roadmap), served over MCP, OpenAPI/REST and as agent skills.
The `quartal-hub` GitHub organization hosts only public repositories; private Quartal repositories
live in `quartal-accounting`. Never commit secrets or internal references here.

Related products (context for naming): **Quartal Plugins** (this repo) is the open-source framework
for *creating* plugins. **Quartal Hub** is the separate commercial registry where plugins can be
published and discovered; a future `@quartal/hub` client library will cover Hub-specific concerns
(auth, user management, reports). Plugin authors scaffold new plugins with the
`@quartal-hub/create-plugin` starter kit (`pnpm create @quartal-hub/plugin`) or the
[`quartal-hub/plugin-template`](https://github.com/quartal-hub/plugin-template) repository — not
from this repo.

> `README.md` is a **generated file** (exported from the quartal docs repository) and describes the
> product's target state — some described features may not exist yet. Do not edit it directly.

**pnpm workspace** (Node 20+, no Deno). A Quartal Plugin is an **Astro project** that adds the
`qrtlPlugin()` integration. Install with `pnpm install` at the root.

- No custom registry needed — everything installs from npm. Tool type-introspection uses the
  TypeScript compiler via **`ts-morph`** (a build-time dependency of `@quartal/plugin`).
- `pnpm run build` — build every workspace project (`build:libs` for just `@quartal/plugin-core` + `@quartal/plugin`).
- `pnpm run test` — run all workspace tests (currently the `@quartal/plugin` suite).
- `pnpm run typecheck` — `vue-tsc`/`tsc` across packages (kept out of `build`).

## Libraries

| Package                    | Role                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `@quartal/plugin-core`     | Core types + HTTP client for connecting to a published plugin (npm)                           |
| `@quartal/plugin`          | The Astro integration + Vite codegen plugin + Hono runtime for creating plugins (npm)         |
| `@quartal/ui-plugin`       | Vue artifact UI components (workspace pkg; Storybook here)                                    |
| `@quartal/plugin-docs-web` | Docs SPA; its `build` vendors into `@quartal/plugin/static/plugin-docs-web` (see its README)  |

Runnable example plugins live in [`samples/`](./samples/) (`@samples/*`, private, not published).

## A plugin's layout

`astro.config.mjs` (`integrations:[qrtlPlugin()]`, `output:'server'`, adapter), `qrtl.config.ts`
(title/style/auth/deploy/widgets), `package.json`, `src/tools/` (tool classes analyzed by the codegen
plugin), `src/pages/widgets/` (one page per tool, any framework), `skills/`, `public/`. The generated
`src/qrtl-plugin/` (metadata + `tools.registry.ts`) is gitignored.

## Run a plugin locally

- Any `@samples/*`: `cd samples/<name> && pnpm install && npm run dev` → `astro dev`.
  - `POST /api/<Class>/<method>`, docs SPA at `/`, `/plugin.json`, `/skills/catalog.json`, MCP at `/mcp`,
    widgets at `/widgets/<toolId>`.
- Build + run: `npm run build` then `node ./dist/server/entry.mjs` (`@astrojs/node` standalone).
- `@quartal/ui-plugin` Storybook: `pnpm --filter @quartal/ui-plugin storybook` (port 6007).
- Refresh the vendored docs SPA after a `ui-plugin`/SPA change: `pnpm --filter @quartal/plugin-docs-web build`.
- For local MCP/widget testing we recommend [MCPJam](https://www.mcpjam.com/).

## UI styling (Bootstrap skins)

White-label products use Bootstrap-based **skins** (CSS from CDN). See `.cursor/rules/ui-styling.mdc`.
Summary: use Bootstrap classes; avoid Tailwind/shadcn; add a root `q-` class per component for skin
overrides; use Bootstrap CSS variables (e.g. `var(--bs-primary)`) for colors.

## Before PR

1. `pnpm install && pnpm run build && pnpm run test`
2. Push branch and open a PR (never push to `main`).
