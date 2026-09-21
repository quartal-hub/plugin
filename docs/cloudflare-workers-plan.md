# Cloudflare Workers support — work plan

Status: **planned, not started.** The `cloudflare` deployment target
([deployment/README.md](../deployment/README.md)) stages and builds a valid Worker bundle today,
but the runtime cannot serve a plugin from inside a Worker. This document is the plan for closing
that gap in `@quartal/plugin`. Strategically, Workers is the target we want for Quartal Hub:
near-zero cold starts, ~$5/mo for hundreds of sites, and first-class APIs (DNS, custom hostnames,
Workers for Platforms) for provisioning tenant environments programmatically.

## Why it fails today

A Worker has no real filesystem. With `nodejs_compat` (default for compatibility dates ≥
2026-08-04), `node:fs` exists but reads a **virtual, memory-backed FS**: `/bundle` (read-only,
only the modules bundled into the Worker), `/tmp` (per-request, counts against the 128 MB memory
limit). `process.cwd()` is `/bundle`. Nothing outside the bundle is readable, and directories that
were never bundled cannot be enumerated.

The plugin runtime, by contrast, reads from the plugin root **on every request**:

| What it reads                                   | Where                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `package.json`, `qrtl.config.*`, `README.md`    | `Helpers.getPluginManifest` / `loadQrtlConfig` (runtime `import()` of the config file) |
| `src/qrtl-plugin/*.json` (tools, OpenAPI, MCP)  | `PluginApiHelper.prepareTools`                                          |
| `skills/` (discovery, files, zip assembly)      | `skillDiscovery` / `skillRoutes` / `skillZip`                           |
| `agents/`                                       | `discoverAgents` / `agentRoutes`                                        |
| `public/`                                       | `publicFolderRoutes`                                                    |
| docs SPA (`static/plugin-docs-web/`)            | `getPkgDocsWebStaticRoot` — `createRequire().resolve("@quartal/plugin")` |
| widget pages (live Astro fetch)                 | `runtimeWidgets` (fetch-based — already Worker-compatible)              |

Observed with `npx wrangler dev` in a stage: `getPkgDocsWebStaticRoot()` cannot resolve
`@quartal/plugin`, its `import.meta.url` fallback is not a usable base URL, and `getAnonApp()`
throws — every route answers `500 TypeError: Invalid URL string`. Fixing only that would still
leave a plugin with no tools, skills, agents or docs.

What already works on Workers: Hono (first-class target), `jose` (WebCrypto), the MCP SDK's
streamable-HTTP transport, and the sessions story (`@astrojs/cloudflare` uses a KV binding).

## Design principle

**Everything the runtime needs must be importable or injected — never discovered from disk at
request time.** The codegen already runs at build time and already knows the full inventory; the
change is to emit it as modules the bundler can see, and make the runtime prefer injected data
over disk reads. Disk reads stay as the fallback so `astro dev`, tests and Node hosts keep working
unchanged. Steps 1–3 are worth doing on every platform: they remove per-request disk I/O from the
hot path.

## Work items

### 1. Generated artifacts as an importable module *(turns "500 everywhere" into "working plugin")*

- Codegen (`qrtlCodegenPlugin`) additionally emits `src/qrtl-plugin/artifacts.ts` that re-exports
  the JSON artifacts (`tools`, `open-api`, `types`, `contents`, `mcp-tools`, `mcp-prompts`) as
  typed values.
- The generated Astro middleware (`buildPluginMiddlewareSource` in `astro/integration.ts`) imports
  it and passes `artifacts` into `getAnonApp` / `getAuthApp`.
- `PluginApiHelper.prepareTools` prefers `config.artifacts` over the `readIfExists` disk reads.

### 2. Manifest resolved at build time

- The integration already loads `qrtl.config` at config time; also resolve `package.json` +
  `README.md` there and pass the built `PluginManifest` (or its inputs) through the middleware as
  `config.manifest` / `config.readme`.
- `Helpers.getPluginManifest` and the `loadQrtlConfig` call sites prefer the injected values.
  This also removes the runtime `import()` of a `.ts` config file, which no bundled platform
  supports well.

### 3. Docs SPA from bundled assets

- `getPkgDocsWebStaticRoot()` must fail soft (docs route answers 503, app still builds).
- Serve the SPA from one of:
  - a build-time copy into the Astro `public/` output, served by Workers Static Assets via the
    `ASSETS` binding (preferred — assets are free and cached), or
  - a CDN URL (the `readStaticBytes` helper already supports `http(s):` roots), or
  - bundle-relative imports under `/bundle`.
- The integration can do the copy in `astro:build:done`, keeping `@quartal/plugin` runtime-agnostic.

### 4. Skills, agents and `public/` from a build-time file map

- Codegen emits a manifest of `skills/` and `agents/` (paths + metadata + file contents or asset
  references). Discovery (`skillDiscovery`, `discoverAgents`) prefers the manifest; directory walks
  remain the dev/Node fallback.
- `skillZip` assembles zips from the manifest's contents instead of `readdir`/`readFile`.
- `public/` routes through the `ASSETS` binding on Workers (Astro already ships `public/` into
  `dist/client`); `publicFolderRoutes` keeps the disk path as fallback.

### 5. Platform config in the deployment target

Already staged by `deployment/targets/cloudflare.mjs`; to revisit when the runtime lands:

- Compatibility date: keep ≥ 2025-09-01 (virtual `node:fs`). **Known sharp edge:** with dates ≥
  2025-09-15, the native `process` v2 makes Astro SSR return `[object Object]`
  ([withastro/astro#15434](https://github.com/withastro/astro/issues/15434)) — set the
  `disable_nodejs_process_v2` compatibility flag until Astro fixes it.
- `SESSION` KV namespace binding (the adapter requests it), or disable Astro sessions.
- Bundle budget: the Worker size limit is 64 MiB uncompressed (raised 2026-09), so bundling skill
  contents is viable; static assets are limited to 25 MiB/file and are free to serve.
- Env vars (`OAUTH_*` for `auth: "custom"`) become Worker secrets/vars; on Workers they arrive per
  request via bindings, but `nodejs_compat` populates `process.env`, which the oauth code reads.

### 6. Verification harness

The deployment stage is the harness — no new infrastructure:

```bash
node deployment/deploy.mjs cloudflare test1 --stage-only   # build the Worker bundle
cd .deploy/cloudflare/test1 && npx wrangler dev            # run it in workerd locally
npx wrangler deploy --dry-run                              # validate the upload offline
```

Acceptance: in `wrangler dev`, `/plugin.json`, `/open-api.json`, `/skills/catalog.json` (and a
skill zip download), `/agents/catalog.json`, `/mcp` `tools/list`, a widget page, and the docs SPA
at `/` all answer as they do on the Railway stage. Then remove the `--force` guard from the
cloudflare target.

## Suggested order

1 and 2 first (small, unblock everything, benefit all platforms) → 3 (docs SPA, fail-soft first,
asset serving second) → 4 (largest item; skills zip last) → 5/6 (config + verification) → publish
`@quartal/plugin`, flip the target's status in `deployment/README.md`, and update the website's
Cloudflare deployment guide (drop its "not supported yet" warning).

## Later: Quartal Hub provisioning (out of scope here)

Once a plugin runs as a Worker, Hub environments become API calls: wrangler/Terraform per-env
Workers (`[env.test]` / `[env.production]`), DNS records + custom domains on a Cloudflare-hosted
zone (free, full REST API), and — at tenant scale — Workers for Platforms dispatch namespaces
($25/mo, 1000 scripts included) with Cloudflare for SaaS custom hostnames (100 free, then
$0.10/hostname/mo). None of that work starts until this plan's items 1–6 are done.
