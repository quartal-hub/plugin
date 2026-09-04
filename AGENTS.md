# Agent instructions

## Repo

This is [`quartal-hub/plugin`](https://github.com/quartal-hub/plugin) — the **public, open-source
(MIT) home of Quartal Plugins**: packaged business functionality for AI agents (Tools, Widgets,
Agent Skills, Agents), served over MCP, OpenAPI/REST and as agent skills.
The `quartal-hub` GitHub organization hosts only public repositories; private Quartal repositories
live in `quartal-accounting`. Never commit secrets or internal references here.

Related products (context for naming): **Quartal Plugins** (this repo) is the open-source framework
for *creating* plugins. **Quartal Hub** is the separate commercial registry where plugins can be
published and discovered; a future `@quartal/hub` client library will cover Hub-specific concerns
(auth, user management, reports). Plugin authors scaffold new plugins with the
`@quartal/create-plugin` starter kit (`pnpm create @quartal/plugin`) or the
[`quartal-hub/plugin-template`](https://github.com/quartal-hub/plugin-template) repository — not
from this repo.

> `README.md` is a **generated file** (exported from the quartal docs repository) and describes the
> product's target state — some described features may not exist yet. Do not edit it directly.

**pnpm workspace** (Node 22+). A Quartal Plugin is an **Astro project** that adds the
`qrtlPlugin()` integration. Install with `pnpm install` at the root.

- No custom registry needed — everything installs from npm. Tool type-introspection uses the
  TypeScript compiler via **`ts-morph`** (a build-time dependency of `@quartal/plugin`).
- `pnpm run build` — build every workspace project (`build:libs` for just `@quartal/plugin-core` + `@quartal/plugin` + `@quartal/plugin-vue`).
- `pnpm run test` — run all workspace tests (currently the `@quartal/plugin` suite).
- `pnpm run typecheck` — `vue-tsc`/`tsc` across packages (kept out of `build`).
- `pnpm run lint` — ESLint import-hygiene rules (`lint:fix` auto-fixes import order).

## Code organization

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full rules. Summary: one primary artifact per
file, named after the file. Barrels (`index.ts`) exist **only** at package roots, npm subpath
entries (`astro/`, `widget/`), and `model/` folders — implementation folders have none. Import
concrete files directly with explicit `.ts` extensions; the one sanctioned barrel import is the
model facade (`../model/index.ts`). Never import your own folder's or parent's barrel — ESLint
bans it (cycle risk). `model/` is the bottom layer and must not import from implementation
folders.

## Libraries

| Package                    | Role                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `@quartal/plugin-core`     | Core types + HTTP client for connecting to a published plugin (npm)                           |
| `@quartal/plugin`          | The Astro integration + Vite codegen plugin + Hono runtime for creating plugins (npm)         |
| `@quartal/plugin-vue`      | Vue bindings for widgets (composables over the framework-agnostic `@quartal/plugin/widget`)   |
| `@quartal/ui-plugin`       | Vue artifact UI components (workspace pkg; Storybook here)                                    |
| `@quartal/plugin-docs-web` | Docs SPA; its `build` vendors into `@quartal/plugin/static/plugin-docs-web` (see its README)  |
| `@quartal/website`         | Marketing + docs web site for the product (`website/`, Astro + Vue, static; not published)   |

Runnable example plugins live in [`samples/`](./samples/) (`@samples/*`, private, not published).

## A plugin's layout

`astro.config.mjs` (`integrations:[qrtlPlugin()]`, `output:'server'`, adapter), `qrtl.config.ts`
(title/style/auth/deploy/widgets), `package.json`, `src/tools/` (tool classes analyzed by the codegen
plugin), `src/prompts/` (optional MCP prompt classes — same convention: each function takes one object
parameter whose properties become the prompt arguments, returns a string or `{ messages }`),
`src/pages/widgets/` (one page per tool, any framework), `skills/`, `agents/` (one `.md`/`.json`
per agent — see [docs/agents.md](./docs/agents.md)), `public/`. The generated
`src/qrtl-plugin/` (metadata + `tools.registry.ts` + `prompts.registry.ts`) is gitignored.

## Run a plugin locally

- Any `@samples/*`: `cd samples/<name> && pnpm install && npm run dev` → `astro dev`.
  - `POST /api/<Class>/<method>`, docs SPA at `/`, `/plugin.json`, `/skills/catalog.json`, MCP at `/mcp`,
    widgets at `/widgets/<toolId>`, agents at `/agents/catalog.json`.
- Build + run: `npm run build` then `node ./dist/server/entry.mjs` (`@astrojs/node` standalone).
- `@quartal/ui-plugin` Storybook: `pnpm --filter @quartal/ui-plugin storybook` (port 6007).
- Refresh the vendored docs SPA after a `ui-plugin`/SPA change: `pnpm --filter @quartal/plugin-docs-web build`.
- For local MCP/widget testing we recommend [MCPJam](https://www.mcpjam.com/).

## UI styling (Bootstrap skins)

White-label products use Bootstrap-based **skins** (CSS from CDN). See `.cursor/rules/ui-styling.mdc`.
Summary: use Bootstrap classes; avoid Tailwind/shadcn; add a root `q-` class per component for skin
overrides; use Bootstrap CSS variables (e.g. `var(--bs-primary)`) for colors.

## Before PR

1. `pnpm install && pnpm run build && pnpm run test && pnpm run lint`
2. Push branch and open a PR (never push to `main`).
3. When working on Olli's local computer, include any pre-existing uncommitted changes in the
   working tree (e.g. a regenerated `README.md`) in the PR — do not leave them behind.
