# Contributing to Quartal Plugins

Thanks for your interest in contributing! This repository is a pnpm workspace requiring Node 22+.
The pnpm version is pinned in `packageManager`, so `corepack enable` gets you the right one.

See [AGENTS.md](./AGENTS.md) for the repository map, how to run the sample plugins, and UI styling
rules.

## Getting the code

You do not need write access to this repository. Contributions come in as pull requests from a
fork — the same flow whether you are inside Quartal or not.

1. **Fork** `quartal-hub/plugin` on GitHub (the *Fork* button, top right).

2. **Clone your fork** and add this repository as `upstream`, so you can pull in changes later:

   ```bash
   git clone https://github.com/<your-username>/plugin.git
   cd plugin
   git remote add upstream https://github.com/quartal-hub/plugin.git
   ```

   `origin` is now your fork (you can push to it) and `upstream` is this repository (you cannot).

3. **Install and verify the baseline** before changing anything, so a pre-existing failure is not
   mistaken for one of yours:

   ```bash
   corepack enable
   pnpm install
   pnpm run build
   pnpm run typecheck
   pnpm run test
   pnpm run lint
   ```

   **Run `build` before `typecheck` and `test`.** `@quartal/plugin-core` publishes its types from
   `dist/`, so on a fresh clone every package importing it fails to resolve until it has been built
   once. A wall of "Cannot find module '@quartal/plugin-core'" errors means the build has not run.

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

## Changesets

Any change to a **published** package needs a changeset — `@quartal/plugin`, `@quartal/plugin-core`,
`@quartal/plugin-vue`, and `@quartal/ui-plugin`. The samples and `@quartal/plugin-docs-web` are
private and need none.

```bash
pnpm changeset
```

Pick the affected packages, pick `patch` / `minor` / `major`, and write one line describing the
change for someone *consuming* the package. Commit the generated file in `.changeset/` with your
work. Releases are cut from these, so a missing changeset means your change ships without a version
bump or a changelog entry.

A README change also needs one: a README only reaches npm as part of a new version.

## Comments

Comments describe what the code does now, and warn about edits that would break it. They do not
record what changed or why relative to a previous version — that belongs in your commit message and
pull request description, which is where people go looking for history.

```ts
// Good: Do not add registry-url — it writes an .npmrc auth entry that breaks OIDC publishing.
// Avoid: Removed registry-url because the token was deleted and this now uses OIDC instead.
```

## Generated and vendored files

Some committed files are build outputs. Editing them directly is lost work:

- Any file whose header says **GENERATED FILE** is produced by the export script in the Quartal
  docs repository. Change the source there, not the copy here.
- `@quartal/plugin/static/plugin-docs-web/` is the built `@quartal/plugin-docs-web` SPA, vendored in
  by that package's `build`. Change the SPA source and rebuild.

## Opening a pull request

1. **Branch from an up-to-date `main`.** Never commit on `main` itself — keeping it clean is what
   lets you sync from `upstream` without conflicts:

   ```bash
   git fetch upstream
   git checkout -b my-change upstream/main
   ```

2. **Make your change**, and add a changeset if you touched a published package.

3. **Run the full gate**, in this order:

   ```bash
   pnpm run build && pnpm run typecheck && pnpm run test && pnpm run lint
   ```

4. **Push the branch to your fork** — `origin`, not `upstream`. You have no write access here, so
   pushing to this repository fails; that is expected, not a misconfiguration:

   ```bash
   git push -u origin my-change
   ```

5. **Open the pull request** against `quartal-hub/plugin`, base branch `main`. The push prints a
   link that pre-fills it, or use the *Compare & pull request* button on your fork. Describe what
   changed and why — pull requests are squash-merged, so your description becomes the commit message
   that survives in history, while your individual commits do not.

6. **Wait for CI.** The `check` workflow runs automatically on pull requests, including those from
   forks, and repeats the gate from step 3. Fix anything red and push again to the same branch; the
   pull request updates itself.

If `upstream/main` moves while your pull request is open and you need the newer code:

```bash
git fetch upstream
git rebase upstream/main
git push --force-with-lease
```
