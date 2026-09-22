# Cloudflare Workers support — design notes

A Quartal plugin runs as a Cloudflare Worker: `@astrojs/cloudflare` builds the Worker, wrangler
uploads it, and every route — manifest, OpenAPI, skills, agents, `/plugin.zip`, MCP, REST tool
execution, widget pages and the docs site — serves from the bundle.
[`samples/prh-opendata`](../samples/prh-opendata) is the reference deployment (in place, via its
`deploy` script); the `cloudflare` target in [deployment/](../deployment/README.md) stages any
sample for Workers.

Strategically, Workers is the target we want for Quartal Hub: near-zero cold starts, ~$5/mo for
hundreds of sites, and first-class APIs (DNS, custom hostnames, Workers for Platforms) for
provisioning tenant environments programmatically.

## The constraint

A Worker has no real filesystem. With `nodejs_compat`, `node:fs` exists but reads a **virtual,
memory-backed FS**: `/bundle` (read-only, only the modules bundled into the Worker) and `/tmp`
(per-request, counts against the 128 MB memory limit). `process.cwd()` is `/bundle`. Nothing
outside the bundle is readable, and directories that were never bundled cannot be enumerated.

## Design principle

**Everything the runtime needs must be importable or injected — never discovered from disk at
request time.** The codegen runs at build time and knows the full inventory, so it emits it as
modules the bundler can see, and the runtime prefers injected data over disk reads. Disk reads
remain only as the fallback for `astro dev`, tests and Node hosts, where they keep working
unchanged. This also removes per-request disk I/O from the hot path on every platform.

## How the runtime stays filesystem-free

- **Generated artifacts as a module.** Codegen emits `src/qrtl-plugin/artifacts.ts`; the generated
  middleware passes it to `getAnonApp` / `getAuthApp` as `config.artifacts`
  (`PluginRuntimeArtifacts`), and `PluginApiHelper` prefers the injected values over disk reads.
- **Manifest resolved at build time.** The artifacts module also carries the resolved
  `PluginManifest`, the README text, the `qrtl.config` auth mode + `mcp` options and the resolved
  widget entries, so the runtime never imports `qrtl.config.ts` or scans `src/pages/widgets/`.
- **Docs UI from the published shell.** The docs site is a chrome-less page on the Quartal Plugins
  website (`/plugin-index`). `docsShell.ts` fetches it over HTTP, rewrites asset URLs to the
  shell's origin, injects the skin and serves it at `/`, cached in memory (1 h TTL, stale
  fallback, 10 s fetch timeout) and failing soft with a 503 on the docs page only.
  `QRTL_DOCS_WEB_URL` overrides the URL. A plugin's own `src/pages/index.*` replaces the shell.
- **Skills, agents and README from a file map.** Codegen captures the `skills/` and `agents/` trees
  into the artifacts module (`PluginFileMapEntry[]`: text inlined as UTF-8, binaries base64, a
  warning above 1 MB per file). Skill discovery, skill files and zips, agent discovery and
  `/plugin.zip` all read the map. `public/` needs no map: Astro ships it into the static output and
  Workers static assets serve it before the Worker runs.
- **No per-process state that must be shared.** MCP is stateless per request, the OAuth login flow
  keeps its PKCE state in an HttpOnly cookie, and `PluginCache` defaults to a per-isolate memory
  cache that every route can live without (a Cloudflare KV backend can be injected with
  `setPluginCache`).

## Platform configuration

`wrangler.jsonc` needs `compatibility_date` ≥ `2025-09-01` (so `node:fs` exists for the fallback
imports) and `compatibility_flags: ["nodejs_compat"]`. The samples use `2026-08-01`. With that
date `process.env` is populated from Worker vars and secrets, which is where the runtime reads
`OAUTH_*` and `QRTL_DOCS_WEB_URL`. No `SESSION` KV binding is configured: plugins do not use Astro
sessions.

Under pnpm, `workerd` must be allowed to run its install script (`allowBuilds` in
`pnpm-workspace.yaml`); otherwise `wrangler dev` and `astro dev` cannot start the runtime.

## Limits that still apply

These are Workers platform limits, not framework gaps. None has been hit by the samples, but a
plugin can grow into them:

- **Bundle size** — 3 MB compressed on the free plan, 10 MB on paid. The server bundle of
  `prh-opendata` is 2.5 MB uncompressed. Every skill and agent file is inlined into it, so a plugin
  with large skill assets should keep them out of `skills/` (link to them instead) or move to paid.
- **CPU time** — 10 ms per request on the free plan, 30 s (configurable) on paid. Waiting on
  upstream `fetch` does not count, but assembling `/plugin.zip`, skill zips and `/open-api.json`
  does. A large plugin should assume the paid plan.
- **Memory** — 128 MB per isolate; the file map and zips are built in memory.
- **Per-isolate caches** — the docs shell cache and `MemoryCache` are cold on every new isolate.
  That costs one shell fetch per isolate and makes `PluginCache` a best-effort cache; anything that
  must persist needs a KV-backed `PluginCache`.
- **Untested combinations** — the samples deployed so far are `auth: "anon"`. `jose`, the OAuth
  cookie flow and `node:crypto` all run under `nodejs_compat`, but an `auth: "custom"` or
  `auth: "quartal-hub"` plugin has not yet been exercised on a deployed Worker.

## Later: Quartal Hub provisioning

Once a plugin runs as a Worker, Hub environments become API calls: wrangler/Terraform per-env
Workers (`[env.test]` / `[env.production]`), DNS records + custom domains on a Cloudflare-hosted
zone (free, full REST API), and — at tenant scale — Workers for Platforms dispatch namespaces
($25/mo, 1000 scripts included) with Cloudflare for SaaS custom hostnames (100 free, then
$0.10/hostname/mo). That planning continues in the Quartal Hub project.
