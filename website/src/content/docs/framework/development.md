---
title: "Developing the framework"
description: "For contributors to Quartal Plugins itself — not needed for creating plugins."
section: framework
order: 1
---

> **Audience note.** Everything else on this site is for **plugin creators** — people building
> plugins *with* Quartal Plugins. This page is for developers working on the
> [quartal-hub/plugin](https://github.com/quartal-hub/plugin) framework itself. If you are
> creating a plugin, you can safely ignore it.

## Repository layout

The framework is a pnpm workspace (Node 22+):

| Package | Role |
|---|---|
| `@quartal/plugin-core` | Core types + HTTP client for connecting to a published plugin |
| `@quartal/plugin` | The Astro integration + Vite codegen plugin + Hono runtime |
| `@quartal/plugin-vue` | Vue bindings for widgets |
| `@quartal/ui-plugin` | Vue artifact UI components (Storybook) |
| `@quartal/plugin-docs-web` | The docs SPA vendored into every plugin |
| `website` | This web site |
| `samples/*` | Runnable example plugins |

## Contributor documentation

The in-depth internal docs live in the repository, next to the code they describe:

- [CONTRIBUTING.md](https://github.com/quartal-hub/plugin/blob/main/CONTRIBUTING.md) — the
  fork-based contribution workflow and code-organization rules.
- [AGENTS.md](https://github.com/quartal-hub/plugin/blob/main/AGENTS.md) — repo conventions,
  build/test commands, and a map of the codebase (also read by coding agents).
- [docs/schema-generation.md](https://github.com/quartal-hub/plugin/blob/main/docs/schema-generation.md)
  — how the ts-morph analyzer turns TypeScript + JSDoc into JSON Schemas, in generator-level
  detail.
- [docs/mcp-sdk.md](https://github.com/quartal-hub/plugin/blob/main/docs/mcp-sdk.md) — the MCP
  SDK version matrix and protocol-era notes.
- [docs/agents.md](https://github.com/quartal-hub/plugin/blob/main/docs/agents.md) — the agent
  definition format internals.

## Build and test

```bash
pnpm install
pnpm run build      # build every workspace project
pnpm run test       # run all workspace tests
pnpm run lint       # ESLint import-hygiene rules
```

Never push to `main` — push a branch and open a pull request.
