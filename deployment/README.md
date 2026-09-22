# Deploying Quartal plugins

Scripts for deploying the sample plugins in [`samples/`](../samples) to **Vercel**, **Railway**
and **Cloudflare Workers**.

This is an example of deployment scripts for a situation where the project contains Workspace dependencies
or if you wish to keep Node adapter in the original project and swap it only for deployment to adapter of
deployment target (Vercel, Cloudflare).

Note that Cloudflare's Wrangler uploads a bundle that pnpm already resolved, so you can use direct deployment
(like `samples/prh-opendata` does). For Vercel and Railway, you must the deployment script or similar method
to resolve the pnpm workspace dependencies.

How to use:

```bash
node deployment/deploy.mjs <target> <project> [options]
pnpm deploy-plugin <target> <project> [options]   # same thing, via the root script
```

Everything after a bare `--` goes to the platform CLI (for example `-- --prod` for a Vercel
production deploy). **PowerShell swallows the first `--`** before pnpm or node sees it, so there
the separator has to be doubled or quoted:

```powershell
pnpm deploy-plugin vercel test1 -- -- --prod
pnpm deploy-plugin vercel test1 '--' --prod
```

Git Bash and `cmd` pass a single `--` through as written.

| Target       | Platform           | Adapter               | 
| ------------ | ------------------ | --------------------- | 
| `vercel`     | Vercel             | `@astrojs/vercel`     | 
| `railway`    | Railway            | `@astrojs/node`       | 
| `cloudflare` | Cloudflare Workers | `@astrojs/cloudflare` | 

Everything lives in this one folder. A plugin is identified by its directory name under
`samples/`, and its remote name comes from the `deploy` block in its `qrtl.config.ts`:

```ts
deploy: { org: "quartal", app: "test1" },
```

```bash
node deployment/deploy.mjs list                        # targets + deployable plugins
node deployment/deploy.mjs vercel test1                # preview deploy to Vercel
node deployment/deploy.mjs vercel test1 -- --prod      # production deploy to Vercel
node deployment/deploy.mjs railway test1               # deploy test1 to Railway
node deployment/deploy.mjs cloudflare test1 --stage-only
node deployment/deploy.mjs railway test1 --dry-run     # print every command, run nothing
node deployment/deploy.mjs --help
```

## Why staging exists

This project is a PNPM workspace and internal dependencies resolve `@quartal/*` through `workspace:*`.
Cloudflare deployment process handles this, but Vercel or Railway need dependencies to be resolved.
So every target goes through the same two phases:

**1. Stage** — `.deploy/<target>/<project>/` (gitignored) is built as a standalone npm package:

- the plugin's sources are copied, minus `node_modules/`, `dist/`, `.astro/`, `.wrangler/` and the
  generated `src/qrtl-plugin/` (which `astro build` regenerates);
- `workspace:*` specifiers are rewritten (see [`--link`](#link-modes));
- the target's Astro adapter is added to `dependencies`, and `start` is wired up;
- `astro.config.mjs` is **replaced** by a generated file that imports the plugin's own config as
  `astro.config.base.mjs` and overrides only the adapter. Integrations, `output`, widget config and
  everything else carry over untouched, so a sample never needs to know how it will be hosted:

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

### In-place deploys

Cloudflare never sees `package.json`: wrangler uploads the Worker that `@astrojs/cloudflare` built
locally, where pnpm has already resolved the workspace links. A sample that carries the Cloudflare
adapter and a `wrangler.jsonc` itself — [`prh-opendata`](../samples/prh-opendata) does, as the
Cloudflare example — therefore also deploys straight from its own directory:

```bash
cd samples/prh-opendata && pnpm deploy     # astro build && wrangler deploy
```

That is the path a plugin author follows (see the website's deployment guides). The `cloudflare`
target still earns its place for two things the in-place path cannot do: deploying a sample that
is configured for another adapter without editing it, and building against the **published**
`@quartal/*` packages (`--link registry`) rather than the workspace build, which is the only way
to check that a release works on Workers.

Vercel and Railway have no in-place path from this repo — they always install from the registry.

### Link modes

| `--link`             | `@quartal/*` resolves to                                                               | Use when                                    |
| -------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| `registry` (default) | the published packages on npm                                                          | normal deploys                              |
| `local`              | tarballs packed from the built workspace packages (`vendor/*.tgz`, `file:` specifiers) | validating an unpublished change end to end |

`--link local` requires `pnpm run build:libs` first — it packs each package's `dist/`, so an
unbuilt package is an error rather than a silently stale deploy. Tarballs, not directories: npm
installs a `file:` directory as a symlink in `node_modules`, which module tracers (Vercel's nft)
turn into dangling links inside the function bundle — and which Windows refuses to create at all.
A tarball installs as a real copy everywhere.

## Targets

### Vercel

Astro SSR on Vercel Functions (Node.js runtime, Fluid compute). Vercel builds the uploaded sources
(`npm install` → `astro build`), but the function it assembles contains only _traced modules_ and
runs in `/var/task` — not next to the plugin's files. That needs no configuration: the codegen's
`artifacts.ts` module carries the generated metadata, manifest, `qrtl.config` options, widget
entries and the skills/agents/README file map inside the server bundle; the docs UI shell is
fetched from the Quartal Plugins website at runtime; and `public/` ships in Vercel's static
output, served before the function. The adapter runs with no options, and
`Helpers.resolvePluginRoot` keeps the relocated cwd safe as a fallback.

```bash
node deployment/deploy.mjs vercel test1             # preview deployment
node deployment/deploy.mjs vercel test1 -- --prod   # production
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
- Vercel restores the previous build's `node_modules` from its build cache (separately for
  preview and production). A cached `@quartal/*` version that still satisfies the `^` range is
  kept, so a deploy right after a `@quartal/plugin` release can silently build the old runtime.
  Pass `-- --force` (the Vercel CLI's skip-cache flag) for the first deploy after a release, or
  when a fix that is on npm does not show up.
- Preview deployments sit behind Vercel Authentication: a plain `curl` is redirected to SSO and
  `/api/*` answers 401. Probe them with `npx vercel curl <path> --deployment <url>` from the stage
  (it adds the project's protection-bypass header), or check the production URL.
- The plugin's server paths are not Astro pages, so the integration injects a catch-all route
  (`/[...qrtlPath]`) to keep them in the route table. Without it, Vercel's generated routing sends
  every non-route path to the function with a forced `404` status — the body is right, the status
  is not.

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

### Cloudflare Workers

Astro SSR on the Workers runtime (workerd) — a _finished_ bundle: wrangler ships the Worker that
`@astrojs/cloudflare` builds locally, so this target builds in the stage before deploying.

A Worker has no real filesystem, and the runtime needs none: everything the plugin serves rides
inside the bundle. [docs/cloudflare-workers.md](../docs/cloudflare-workers.md) describes the design
and the platform limits that still apply.

```bash
node deployment/deploy.mjs cloudflare test1 --stage-only   # build the Worker bundle
cd .deploy/cloudflare/test1 && npx wrangler dev            # run it in workerd locally
node deployment/deploy.mjs cloudflare test1                # authenticated deploy
```

- Authenticate with `npx wrangler login` or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
- Plugins do not use Astro sessions, so no `SESSION` KV binding is configured; add a KV namespace
  id to `wrangler.jsonc` if your own pages need sessions.
- Env vars (`OAUTH_*`, `QRTL_DOCS_WEB_URL`) are Worker vars/secrets (`npx wrangler secret put`);
  `nodejs_compat` exposes them on `process.env`, which is where the runtime reads them.

## Options

| Option          | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `--org <name>`  | Platform org/owner. Default: `deploy.org` from `qrtl.config.ts`         |
| `--app <name>`  | Remote app/service name. Default: `deploy.app`, else the directory name |
| `--link <mode>` | `registry` (default) or `local` — see [link modes](#link-modes)         |
| `--build`       | Build in the stage even when the platform builds remotely (pre-flight)  |
| `--no-build`    | Skip the local build                                                    |
| `--stage-only`  | Stage (and build, where applicable) without deploying                   |
| `--dry-run`     | Print every command instead of running it                               |
| `-- <args…>`    | Everything after a bare `--` is passed straight to the platform CLI     |

## Prerequisites

| Target       | CLI                                                 | Auth                                                                     |
| ------------ | --------------------------------------------------- | ------------------------------------------------------------------------ |
| `vercel`     | run via `npx vercel` (no install needed)            | `npx vercel login`, or `VERCEL_TOKEN`                                    |
| `railway`    | `npm i -g @railway/cli`                             | `railway login`, or `RAILWAY_TOKEN`                                      |
| `cloudflare` | bundled `wrangler` (run via `npx` inside the stage) | `npx wrangler login`, or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` |

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
