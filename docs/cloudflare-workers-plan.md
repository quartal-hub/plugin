# Cloudflare Workers support — work plan

Status: **items 1–4 and 6 done — a plugin serves fully in `wrangler dev`.** The remaining steps
are publishing `@quartal/plugin` > 0.8.0 and exercising the first authenticated `wrangler deploy`
(plus whatever item 5 config that surfaces). The `cloudflare` deployment target
([deployment/README.md](../deployment/README.md)) stages, builds and deploys without a `--force`
guard. Strategically, Workers is the target we want for Quartal Hub:
near-zero cold starts, ~$5/mo for hundreds of sites, and first-class APIs (DNS, custom hostnames,
Workers for Platforms) for provisioning tenant environments programmatically.

## The constraint

A Worker has no real filesystem. With `nodejs_compat` (default for compatibility dates ≥
2026-08-04), `node:fs` exists but reads a **virtual, memory-backed FS**: `/bundle` (read-only,
only the modules bundled into the Worker), `/tmp` (per-request, counts against the 128 MB memory
limit). `process.cwd()` is `/bundle`. Nothing outside the bundle is readable, and directories that
were never bundled cannot be enumerated.

With items 1–4 done, nothing in the runtime needs a filesystem: the generated metadata, manifest,
config, widget entries and the skills/agents/README file map ride inside the bundle (items 1–2, 4),
the docs shell is fetched over HTTP (item 3), widget resources are served from the live Astro pages
(fetch-based), `public/` ships as Workers static assets, and Hono, `jose` and the MCP SDK's
streamable-HTTP transport all run on Workers. The disk reads remain only as fallbacks for Node
hosts, dev and tests.

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

### 4. Skills, agents and README from a build-time file map — **done**

Codegen captures the `skills/` and `agents/` trees into the artifacts module (`files`:
`PluginFileMapEntry[]`, text inlined as UTF-8, binaries base64, a warning above 1 MB per file).
The runtime prefers the map everywhere: skill discovery/files/zips (`skillsFromFileMap`, exact-path
lookups), agent discovery/markdown (`agentsFromFileMap`), and `/plugin.zip` (assembled from the map
plus the injected README). Directory walks remain the dev/Node fallback. `public/` needed no map at
all: Astro ships it into the static output, and every platform's static layer (Vercel filesystem
handler, Workers assets) serves it before the function runs.

### 5. Platform config in the deployment target — partially open

- Compatibility date 2026-08-01 with `nodejs_compat`: **verified working in `wrangler dev`** —
  the [astro#15434](https://github.com/withastro/astro/issues/15434) `process` v2 issue did not
  manifest with the current Astro 7 + adapter 14.x combination.
- No `SESSION` KV binding is configured: plugins don't use Astro sessions. Add a KV namespace id
  to `wrangler.jsonc` for plugins whose own pages need them.
- Env vars (`OAUTH_*`, `QRTL_DOCS_WEB_URL`) become Worker vars/secrets; `nodejs_compat` populates
  `process.env`, which the runtime reads.
- **Open:** whatever the first authenticated `wrangler deploy` surfaces (routes, workers.dev
  subdomain, custom domain).

### 6. Verification — **done in `wrangler dev`**

The full acceptance list passes in workerd locally (`--stage-only` + `npx wrangler dev` in the
stage): `/plugin.json`, `/open-api.json` (16 paths), `/skills/catalog.json` + skill files + skill
zips, `/agents/catalog.json` + agent markdown, `/plugin.zip`, `/mcp` `tools/list`, REST execution,
widget pages, and the docs shell at `/` (fail-soft 503 without network; 200 with a reachable shell
URL passed as a Worker var). The `--force` guard is removed from the cloudflare target.

One hard-won note: the docs-shell fetch now has a 10 s abort — a hanging upstream fetch (workerd's
loopback quirk in local dev surfaced it) must 503 the docs page, never wedge the Worker.

## Remaining

Publish `@quartal/plugin` (> 0.8.0), run the first authenticated `wrangler deploy`, fix whatever it
surfaces (item 5), then update the website's Cloudflare deployment guide into a real step-by-step
(drop its "not supported yet" warning).

## Later: Quartal Hub provisioning (out of scope here)

Once a plugin runs as a Worker, Hub environments become API calls: wrangler/Terraform per-env
Workers (`[env.test]` / `[env.production]`), DNS records + custom domains on a Cloudflare-hosted
zone (free, full REST API), and — at tenant scale — Workers for Platforms dispatch namespaces
($25/mo, 1000 scripts included) with Cloudflare for SaaS custom hostnames (100 free, then
$0.10/hostname/mo). None of that work starts until this plan's items 1–6 are done.
