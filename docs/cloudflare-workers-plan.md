# Cloudflare Workers support — work plan

Status: **items 1–3 done, 4–6 remaining.** The `cloudflare` deployment target
([deployment/README.md](../deployment/README.md)) stages and builds a valid Worker bundle today,
and with the artifacts module + remote docs shell the historical "500 on every route" failure is
gone — what remains is the disk-backed content serving (skills/agents/public and `/plugin.zip`,
item 4) and the platform config + verification passes. This document is the plan for closing that
gap in `@quartal/plugin`. Strategically, Workers is the target we want for Quartal Hub:
near-zero cold starts, ~$5/mo for hundreds of sites, and first-class APIs (DNS, custom hostnames,
Workers for Platforms) for provisioning tenant environments programmatically.

## The constraint

A Worker has no real filesystem. With `nodejs_compat` (default for compatibility dates ≥
2026-08-04), `node:fs` exists but reads a **virtual, memory-backed FS**: `/bundle` (read-only,
only the modules bundled into the Worker), `/tmp` (per-request, counts against the 128 MB memory
limit). `process.cwd()` is `/bundle`. Nothing outside the bundle is readable, and directories that
were never bundled cannot be enumerated.

With items 1–3 done, the runtime's remaining per-request disk reads are the content routes:

| What it reads                                   | Where                                          |
| ----------------------------------------------- | ---------------------------------------------- |
| `skills/` (discovery, files, zip assembly)      | `skillDiscovery` / `skillRoutes` / `skillZip`  |
| `agents/`                                       | `discoverAgents` / `agentRoutes`               |
| `public/`                                       | `publicFolderRoutes`                           |
| `README.md` (into `/plugin.zip`)                | `buildAgentPluginZip`                          |

Everything else is already Worker-compatible: the generated metadata, manifest, config and widget
entries ride inside the bundle (items 1–2), the docs shell is fetched over HTTP (item 3), widget
resources are served from the live Astro pages (fetch-based), and Hono, `jose`, the MCP SDK's
streamable-HTTP transport and the sessions story (`@astrojs/cloudflare` uses a KV binding) all run
on Workers.

## Design principle

**Everything the runtime needs must be importable or injected — never discovered from disk at
request time.** The codegen already runs at build time and already knows the full inventory; the
change is to emit it as modules the bundler can see, and make the runtime prefer injected data
over disk reads. Disk reads stay as the fallback so `astro dev`, tests and Node hosts keep working
unchanged. Steps 1–3 are worth doing on every platform: they remove per-request disk I/O from the
hot path.

## Work items

### 1. Generated artifacts as an importable module — **done**

Codegen emits `src/qrtl-plugin/artifacts.ts` importing the JSON artifacts; the generated middleware
passes it to `getAnonApp` / `getAuthApp` as `config.artifacts` (`PluginRuntimeArtifacts`), and
`PluginApiHelper` prefers the injected values over the `readIfExists` disk reads.

### 2. Manifest resolved at build time — **done**

The artifacts module also carries the resolved `PluginManifest`, the README text, the `qrtl.config`
auth mode + `mcp` options, and the resolved widget entries (so runtime widget discovery and the
runtime `import()` of `qrtl.config.ts` are skipped whenever a snapshot is injected). Verified by
deleting `src/qrtl-plugin/`, `qrtl.config.ts` and `README.md` from a built stage: every metadata
route still serves from the bundle.

### 3. Docs UI from the published shell — **done**

Went further than planned: instead of bundling assets, the docs UI shell is a chrome-less page on
the Quartal Plugins website (`/plugin-index`, built from the `@quartal/plugin-docs-web` library).
The runtime (`docsShell.ts`) fetches it over HTTP (Worker-compatible), rewrites its asset URLs to
the shell's origin, injects the skin, and serves it at `/` — cached in memory (1 h TTL, stale
fallback), failing soft (503 on the docs page only) when unreachable. `QRTL_DOCS_WEB_URL`
overrides the URL. The vendored `static/` copy and the `createRequire().resolve()` lookup that
crashed workerd are deleted, and a plugin's own `src/pages/index.*` now overrides the shell
entirely. Verified end to end against a local website preview, including the lazy Swagger/ReDoc
chunks loading cross-origin.

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

4 next (largest item; skills zip last) → 5/6 (config + verification) → publish
`@quartal/plugin`, flip the target's status in `deployment/README.md`, and update the website's
Cloudflare deployment guide (drop its "not supported yet" warning).

## Later: Quartal Hub provisioning (out of scope here)

Once a plugin runs as a Worker, Hub environments become API calls: wrangler/Terraform per-env
Workers (`[env.test]` / `[env.production]`), DNS records + custom domains on a Cloudflare-hosted
zone (free, full REST API), and — at tenant scale — Workers for Platforms dispatch namespaces
($25/mo, 1000 scripts included) with Cloudflare for SaaS custom hostnames (100 free, then
$0.10/hostname/mo). None of that work starts until this plan's items 1–6 are done.
