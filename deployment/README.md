# Deploying Quartal plugins

Scripts for deploying the sample plugins in [`samples/`](../samples) to **Deno Deploy**,
**Cloudflare Workers** and **Railway**.

```bash
node deployment/deploy.mjs <target> <project> [options]
pnpm deploy-plugin <target> <project> [options]   # same thing, via the root script
```

| Target       | Platform            | Adapter                 | Status                                    |
| ------------ | ------------------- | ----------------------- | ----------------------------------------- |
| `railway`    | Railway             | `@astrojs/node`         | Works — verified end to end               |
| `deno`       | Deno Deploy         | `@deno/astro-adapter`   | Builds; deploy needs an account to verify |
| `cloudflare` | Cloudflare Workers  | `@astrojs/cloudflare`   | Blocked — see [Cloudflare](#cloudflare-workers) |

Everything lives in this one folder; nothing is added to the plugins themselves. A plugin is
identified by its directory name under `samples/`, and its remote name comes from the `deploy`
block already present in its `qrtl.config.ts`:

```ts
deploy: { org: "quartal", app: "test1" },
```

```bash
node deployment/deploy.mjs list                        # targets + deployable plugins
node deployment/deploy.mjs railway test1               # deploy test1 to Railway
node deployment/deploy.mjs deno test1 --create         # first deploy: create the app too
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

- the platform's own config file is written (`railway.json`, `deno.json`, `wrangler.jsonc`).

Because the generated config keeps the standard name, `npm run build` produces the right output
whether it runs locally or on the platform's builder.

**2. Deploy** — the stage directory is handed to the platform CLI. Railway and Deno Deploy build the
uploaded sources themselves; Cloudflare uploads a bundle, so that target builds locally first.

### Link modes

| `--link`             | `@quartal/*` resolves to                        | Use when                                  |
| -------------------- | ----------------------------------------------- | ----------------------------------------- |
| `registry` (default) | the published packages on npm (`^0.5.0`)        | normal deploys                            |
| `local`              | copies of the built workspace packages, vendored into `vendor/` and wired up with `file:` | validating an unpublished change, or before the packages are published |

`--link local` requires `pnpm run build:libs` first — it copies each package's `dist/`, so an
unbuilt package is an error rather than a silently stale deploy.

## Targets

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

### Deno Deploy

Deno Deploy builds the uploaded sources (`npm install` → `npm run build`) and then runs
`dist/server/entry.mjs` under Deno in *dynamic* runtime mode, against a real `node_modules` tree —
so the runtime's `node:fs` reads behave as they do under Node.

```bash
node deployment/deploy.mjs deno test1 --create   # first time
node deployment/deploy.mjs deno test1            # after that
```

- Uses the **`deno deploy`** subcommand built into the Deno CLI (Deno ≥ 2.4.2), not `deployctl`:
  Deno Deploy Classic shut down in July 2026 and `deployctl` only ever targeted Classic.
- `--create` runs `deno deploy create` with the build configuration pinned explicitly
  (`--do-not-use-detected-build-config`), so a change to the platform's framework auto-detection
  can't silently alter how a plugin is built. It performs the first deploy as well.
- The generated `deno.json` carries `deploy.org` / `deploy.app` / `deploy.entrypoint`, plus
  `nodeModulesDir: "manual"` so Deno uses the npm-installed tree rather than resolving npm
  specifiers itself.
- Authenticate with `deno deploy login`, or set `DENO_DEPLOY_TOKEN` in CI. `--region us|eu|global`.
- `@deno/astro-adapter` listens on port 8085 locally; Deno Deploy routes to whatever `Deno.serve`
  binds.

Staging and the build are verified locally. The deploy itself is not — that needs a Deno Deploy
account, so treat the first `--create` run as the real test.

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

Making Cloudflare a real target is a change in `@quartal/plugin`, roughly:

1. **Generated artifacts as modules.** Have the codegen emit an importable module (e.g.
   `src/qrtl-plugin/artifacts.ts` re-exporting the JSON) and have the middleware pass it to
   `getAnonApp({ artifacts })`, so `PluginApiHelper` prefers injected artifacts over disk reads.
   This is the one change that turns "empty plugin" into "working plugin".
2. **Manifest at build time.** Resolve `package.json` + `qrtl.config.*` during codegen and inject
   the result, instead of reading and `import()`ing at request time.
3. **Docs SPA assets.** Make `getPkgDocsWebStaticRoot()` fail soft, and serve the SPA from a bundled
   asset map or a CDN URL rather than a `node_modules` path.
4. **Skills, agents and `public/`.** Emit a bundled file map at build time (Workers Assets already
   serves `dist/client`, so `public/` could route through the `ASSETS` binding instead).

Steps 1–3 are also worth doing for their own sake: they remove per-request disk I/O from the hot
path on every platform.

Until then the useful commands are:

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
| `--region <region>` | Deno Deploy region: `us`, `eu` or `global` (default `us`)                |
| `--create`          | Create the remote app before deploying (Deno Deploy)                     |
| `--build`           | Build in the stage even when the platform builds remotely (pre-flight)   |
| `--no-build`        | Skip the local build                                                    |
| `--stage-only`      | Stage (and build, where applicable) without deploying                   |
| `--force`           | Deploy even when the target reports a known blocker                     |
| `--dry-run`         | Print every command instead of running it                               |
| `-- <args…>`        | Everything after a bare `--` is passed straight to the platform CLI      |

## Prerequisites

| Target       | CLI                                                     | Auth                                              |
| ------------ | ------------------------------------------------------- | ------------------------------------------------- |
| `railway`    | `npm i -g @railway/cli`                                 | `railway login`, or `RAILWAY_TOKEN`               |
| `deno`       | Deno ≥ 2.4.2 (<https://deno.com>)                       | `deno deploy login`, or `DENO_DEPLOY_TOKEN`       |
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
    railway.mjs
    deno.mjs
    cloudflare.mjs
```
