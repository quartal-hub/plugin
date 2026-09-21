# Deploying Quartal plugins

Scripts for deploying the sample plugins in [`samples/`](../samples) to **Vercel**, **Railway**
and **Cloudflare Workers**.

```bash
node deployment/deploy.mjs <target> <project> [options]
pnpm deploy-plugin <target> <project> [options]   # same thing, via the root script
```

| Target       | Platform           | Adapter                 | Status                                          |
| ------------ | ------------------ | ----------------------- | ----------------------------------------------- |
| `vercel`     | Vercel             | `@astrojs/vercel`       | Ready — needs `--link local` until `@quartal/plugin` > 0.8.0 is published |
| `railway`    | Railway            | `@astrojs/node`         | Works — verified end to end                     |
| `cloudflare` | Cloudflare Workers | `@astrojs/cloudflare`   | Blocked — see [Cloudflare](#cloudflare-workers) |

Everything lives in this one folder; nothing is added to the plugins themselves. A plugin is
identified by its directory name under `samples/`, and its remote name comes from the `deploy`
block already present in its `qrtl.config.ts`:

```ts
deploy: { org: "quartal", app: "test1" },
```

```bash
node deployment/deploy.mjs list                        # targets + deployable plugins
node deployment/deploy.mjs vercel test1 --link local   # preview deploy to Vercel
node deployment/deploy.mjs vercel test1 --link local -- --prod
node deployment/deploy.mjs railway test1               # deploy test1 to Railway
node deployment/deploy.mjs cloudflare test1 --stage-only
node deployment/deploy.mjs railway test1 --dry-run     # print every command, run nothing
node deployment/deploy.mjs --help
```

## How it works

A sample plugin cannot be handed to a hosting platform as it stands: it is a pnpm-workspace member
that resolves `@quartal/*` through `workspace:*` and shares the repo's root `node_modules`. So every
target goes through the same two phases.

**1. Stage** — `.deploy/<target>/<project>/` (gitignored) is built as a standalone npm package:

- the plugin's sources are copied, minus `node_modules/`, `dist/`, `.astro/` and the generated
  `src/qrtl-plugin/` (which `astro build` regenerates);
- `workspace:*` specifiers are rewritten (see [`--link`](#link-modes));
- the target's Astro adapter is added to `dependencies`, and `start` is wired up;
- `astro.config.mjs` is **replaced** by a generated file that imports the plugin's own config as
  `astro.config.base.mjs` and overrides only the adapter. Integrations, `output`, widget config and
  everything else carry over untouched, and a plugin never needs to know how it will be hosted:

  ```js
  import { defineConfig } from "astro/config";
  import node from "@astrojs/node";
  import base from "./astro.config.base.mjs";

  export default defineConfig({ ...base, adapter: node({ mode: "standalone" }) });
  ```

- the platform's own config file is written (`vercel.json`, `railway.json`, `wrangler.jsonc`).

Because the generated config keeps the standard name, `npm run build` produces the right output
whether it runs locally or on the platform's builder.

**2. Deploy** — the stage directory is handed to the platform CLI. Vercel and Railway build the
uploaded sources themselves; Cloudflare uploads a bundle, so that target builds locally first.

### Link modes

| `--link`             | `@quartal/*` resolves to                        | Use when                                  |
| -------------------- | ----------------------------------------------- | ----------------------------------------- |
| `registry` (default) | the published packages on npm                   | normal deploys                            |
| `local`              | tarballs packed from the built workspace packages (`vendor/*.tgz`, `file:` specifiers) | validating an unpublished change, or before the packages are published |

`--link local` requires `pnpm run build:libs` first — it packs each package's `dist/`, so an
unbuilt package is an error rather than a silently stale deploy. Tarballs, not directories: npm
installs a `file:` directory as a symlink in `node_modules`, which module tracers (Vercel's nft)
turn into dangling links inside the function bundle — and which Windows refuses to create at all.
A tarball installs as a real copy everywhere.

## Targets

### Vercel

Astro SSR on Vercel Functions (Node.js runtime, Fluid compute). Vercel builds the uploaded sources
(`npm install` → `astro build`), but the function it assembles contains only *traced modules* and
runs in `/var/task` — not next to the plugin's files. Two things bridge that gap:

1. The generated `astro.config.mjs` walks the stage at build time and passes everything the plugin
   runtime reads per request to the adapter's `includeFiles`: `package.json`, `README.md`,
   `qrtl.config.*`, the generated `src/qrtl-plugin/*.json`, `skills/`, `agents/`, `public/`, and
   the docs SPA vendored inside `@quartal/plugin`.
2. `@quartal/plugin` (> 0.8.0) resolves its root at runtime: the absolute path baked in at build
   time does not exist in `/var/task`, so `Helpers.resolvePluginRoot` falls back to the function's
   `process.cwd()` (or the `QRTL_PLUGIN_ROOT` env var). **Until that version is on npm, deploy with
   `--link local`** — the published 0.8.0 answers 500 on every route inside a Vercel function.

```bash
pnpm run build:libs                                       # once, for --link local
node deployment/deploy.mjs vercel test1 --link local     # preview deployment
node deployment/deploy.mjs vercel test1 --link local -- --prod
```

- Authenticate with `npx vercel login`, or set `VERCEL_TOKEN` (forwarded as `--token`). Set the
  org with `--org` / `deploy.org` (forwarded as `--scope`).
- The first deploy creates the project (`vercel link --yes --project <app>`); deploys are
  **previews** unless `--prod` is passed through. Preview vs production doubles as the
  test/prod environment split, each with its own env vars (`npx vercel env add`).
- Auth plugins (`auth: "custom"`) need their `OAUTH_*` env vars set per environment before the
  deploy that uses them.
- `--build` pre-flights locally: the Vercel adapter writes `.vercel/output/`, so the function
  bundle (`.vercel/output/functions/_render.func/`) can be inspected without a remote build.

### Railway

The reference target. Railway runs a long-lived Node container, so the whole plugin tree —
`skills/`, `public/`, `README.md`, `qrtl.config.ts` and the generated `src/qrtl-plugin/` — is on
disk at request time, which is exactly what the Quartal plugin runtime expects.

```bash
node deployment/deploy.mjs railway test1
```

- One-time setup: create the service (`railway add --service test1`) and `railway link`, or set
  `RAILWAY_TOKEN` to a project token for CI. Assign a domain with `railway domain`.
- Leave the service's **Root Directory** empty — the stage is uploaded as its own root.
- Railpack runs `npm install` → `npm run build` → `npm start`; `PORT` comes from Railway and the
  generated config sets `server.host = true` so the server binds `0.0.0.0`. The health check hits
  `/plugin.json`.

Verified locally against the published `@quartal/*` packages: staging + `npm install` +
`astro build` + `npm start` serves `/plugin.json` (16 tools, 8 skills, 3 agents),
`/skills/catalog.json`, `/agents/catalog.json`, `/open-api.json` and the docs SPA at `/`.

### Cloudflare Workers

**Blocked today.** The stage builds and the bundle is valid, but the Worker cannot serve a Quartal
plugin, and no amount of deployment scripting changes that. `deploy.mjs` therefore stages and builds
this target but refuses to deploy without `--force`.

A Worker has no filesystem. `node:fs` exists (with `nodejs_compat` and a compatibility date of
2025-09-01 or later) but over a virtual FS whose `process.cwd()` is `/bundle` and which contains
only the modules that ended up in the Worker bundle. The plugin runtime, by contrast, reads from the
plugin root on every request:

| What                                        | Where it happens                            |
| ------------------------------------------- | ------------------------------------------- |
| `package.json`, `qrtl.config.*`, `README.md` | `Helpers.getPluginManifest` / `loadQrtlConfig` (the latter `import()`s the config file) |
| `src/qrtl-plugin/*.json` (tools, OpenAPI, MCP) | `PluginApiHelper.prepareTools`           |
| `skills/`                                    | `skillDiscovery` / `skillRoutes` / `skillZip` |
| `agents/`                                    | `discoverAgents` / `agentRoutes`            |
| `public/`                                    | `publicFolderRoutes`                        |
| docs SPA assets                              | `getPkgDocsWebStaticRoot` — `createRequire().resolve("@quartal/plugin")` |

What actually happens, reproduced with `npx wrangler dev` in the stage: `getPkgDocsWebStaticRoot()`
cannot resolve `@quartal/plugin`, its `import.meta.url` fallback is not a usable base URL, and
`getAnonApp()` throws — **every** route answers `500 TypeError: Invalid URL string`. Were that one
call fixed, the plugin would still come up with no tools, skills, agents or docs, because none of the
artifacts above are readable.

Making Cloudflare a real target is a change in `@quartal/plugin`, not in these scripts. The full
work plan lives in [docs/cloudflare-workers-plan.md](../docs/cloudflare-workers-plan.md). Until it
lands, the useful commands are:

```bash
node deployment/deploy.mjs cloudflare test1 --stage-only   # build the Worker bundle
cd .deploy/cloudflare/test1 && npx wrangler dev            # reproduce the runtime failure
cd .deploy/cloudflare/test1 && npx wrangler deploy --dry-run
```

`@astrojs/cloudflare` also requests a `SESSION` KV binding; a real deploy needs a KV namespace id
for it, or Astro sessions turned off.

## Options

| Option              | Meaning                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `--org <name>`      | Platform org/owner. Default: `deploy.org` from `qrtl.config.ts`          |
| `--app <name>`      | Remote app/service name. Default: `deploy.app`, else the directory name  |
| `--link <mode>`     | `registry` (default) or `local` — see [link modes](#link-modes)          |
| `--build`           | Build in the stage even when the platform builds remotely (pre-flight)   |
| `--no-build`        | Skip the local build                                                    |
| `--stage-only`      | Stage (and build, where applicable) without deploying                   |
| `--force`           | Deploy even when the target reports a known blocker                     |
| `--dry-run`         | Print every command instead of running it                               |
| `-- <args…>`        | Everything after a bare `--` is passed straight to the platform CLI      |

## Prerequisites

| Target       | CLI                                                     | Auth                                              |
| ------------ | ------------------------------------------------------- | ------------------------------------------------- |
| `vercel`     | run via `npx vercel` (no install needed)                | `npx vercel login`, or `VERCEL_TOKEN`             |
| `railway`    | `npm i -g @railway/cli`                                 | `railway login`, or `RAILWAY_TOKEN`               |
| `cloudflare` | bundled `wrangler` (run via `npx` inside the stage)     | `npx wrangler login`, or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` |

Node ≥ 22 for the scripts themselves. They use only Node built-ins — no extra dependencies.

## Adding a target

Drop a module in [`targets/`](./targets) exporting `{ id, title, adapterName, dependencies,
astroImports, astroOverrides, buildsLocally, files(), deploy(), notes }` and register it in the
`TARGETS` map in [`deploy.mjs`](./deploy.mjs). Staging is shared, so a new platform is usually just
its adapter plus its config file and CLI invocation.

## Layout

```
deployment/
  deploy.mjs              CLI: parse args, stage, hand off to a target
  lib/
    log.mjs               console output + DeployError
    run.mjs               command execution (honours --dry-run)
    project.mjs           resolve a samples/ plugin + its qrtl.config deploy metadata
    workspaceDeps.mjs     rewrite workspace:* (registry ranges, or vendored copies)
    stage.mjs             build .deploy/<target>/<project>/, install + build in it
  targets/
    vercel.mjs
    railway.mjs
    cloudflare.mjs
```
