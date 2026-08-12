# Contributing to Quartal Plugins

Thanks for your interest in contributing! This repository is a pnpm workspace (Node 22+). Start with:

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run typecheck
pnpm run lint
```

See [AGENTS.md](./AGENTS.md) for the repository map, how to run the sample plugins, and UI styling
rules. `README.md` is generated — do not edit it directly.

## Code organization

The library packages (`@quartal/plugin-core`, `@quartal/plugin`, `@quartal/ui-plugin`) follow a
consistent module structure. ESLint enforces the import rules (`pnpm run lint`); please follow the
rest by convention:

### One primary artifact per file

Each file exports one primary artifact (class, function, interface, type) named after the file —
`PluginApiHelper.ts` exports `class PluginApiHelper`. Small, tightly-coupled companions may live in
the same file (a function's options interface, a cluster of related catalog types), but keep it to
things you would always read together. This makes every artifact reachable by file name
(Ctrl+P/Cmd+P in editors).

### Barrels only at API boundaries

`index.ts` barrel files exist only where a public surface is defined:

- **Package roots** (`plugin-core/src/mod.ts`, `plugin/src/index.ts`, `ui-plugin/src/index.ts`) —
  the npm public API. `plugin/src/index.ts` uses fully explicit named re-exports (no `export *`)
  so the published surface is reviewable and tree-shakeable.
- **npm subpath entries** (`plugin/src/astro/`, `plugin/src/widget/`) — mapped in package.json
  `exports`.
- **`model/` folders** (and their subfolders) — the shared type layer. `plugin/src/model/index.ts`
  is a facade that also re-exports the `@quartal/plugin-core` types the package consumes.

Implementation folders (`code/`, `hono-app/`, `widgets/`, `vite/`, `helpers/`) have **no** barrels.

### Import rules (lint-enforced)

- **Import concrete files directly** with explicit `.ts` extensions:
  `import { Helpers } from "../helpers/Helpers.ts"` — never extensionless, never a bare folder.
  (TypeScript rewrites `.ts` → `.js` at emit via `rewriteRelativeImportExtensions`.)
- **Exception — the model facade**: import shared types via the barrel in one condensed import:
  `import type { PluginInfo, PluginAppConfig } from "../model/index.ts"`.
- **Never import your own folder's barrel** (`./index.ts`) **or your parent's** (`../index.ts`) —
  the barrel re-exports the importing file, which creates a cycle. Within a folder, import
  siblings file-by-file.
- **No import cycles**, including type-only ones (`import-x/no-cycle`).
- **Import order**: node builtins, then external packages, then relative imports
  (auto-fixable with `pnpm run lint:fix`).

### Layering

`model/` is the bottom layer: it must not import from implementation folders. Runtime layers
(`hono-app/`, `widgets/`, `code/`) depend on `model/`, never the other way around. Shared types
used across layers belong in `model/` (or in `@quartal/plugin-core` if consumed by clients).

## Before opening a PR

1. `pnpm install && pnpm run build && pnpm run test && pnpm run typecheck && pnpm run lint`
2. Push a branch and open a PR — never push to `main`.
