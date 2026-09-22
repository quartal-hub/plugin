# @quartal/plugin

## 0.9.1

### Patch Changes

- 4c9905b: The Astro integration injects a server-rendered catch-all route (`/[...qrtlPath]`, served from
  the new `@quartal/plugin/astro/route` export) so the plugin's runtime paths — `/plugin.json`,
  `/api/*`, `/mcp`, skills, agents, the docs page — are part of Astro's route table. On Vercel the
  adapter mirrors that table into platform routing and forces status 404 on every path without a
  route, which turned every plugin response into a 404 with a correct body. Unclaimed paths still
  end at the project's 404 page.

## 0.9.0

### Minor Changes

- f9e9208: Build-time artifacts module: codegen now emits `qrtl-plugin/artifacts.ts`, an importable snapshot
  of everything the runtime previously read from disk per request — the generated JSON artifacts
  (tools, OpenAPI, types, contents, MCP tools/prompts), the resolved manifest, the README text, the
  `qrtl.config` auth mode and `mcp` options, and the resolved widget entries. The generated Astro
  middleware imports it and passes it to `getAnonApp`/`getAuthApp` via the new
  `PluginAppConfig.artifacts` field (`PluginRuntimeArtifacts`). When present, the snapshot is
  authoritative (no `qrtl.config` disk load, no runtime widget discovery); absent fields fall back
  to the existing disk reads, so tests and non-Astro hosts keep working.
  
  This makes bundled deployments self-contained: a serverless function or Worker serves the plugin's
  metadata, docs, MCP catalog and widgets without `package.json`, `qrtl.config.*` or
  `src/qrtl-plugin/*.json` existing on disk. Only `skills/`, `agents/`, `public/`, `README.md` (for
  `/plugin.zip`) and the docs SPA assets still come from disk.
- f9e9208: Docs UI from the published shell, and `src/pages/index.*` overrides it.
  
  The docs page at `/` is no longer served from files vendored inside this package. Instead the
  runtime fetches the chrome-less shell page published on the Quartal Plugins website
  (`https://plugin.quartal.com/plugin-index/` by default), rewrites its asset URLs to the shell's
  origin, injects the plugin's skin, and serves the result from the plugin's own origin — so the
  SPA's data fetches and the OAuth login flow stay same-origin while no docs assets ship with the
  plugin (the npm package shrinks by ~5 MB, and the `createRequire().resolve()` lookup that crashed
  edge runtimes is gone). The shell is cached in memory with a 1-hour TTL, a failed re-fetch falls
  back to the cached copy, and an unreachable shell fails soft (503 on the docs page only — API and
  MCP are unaffected). Override the URL with the `QRTL_DOCS_WEB_URL` env var (self-hosted copies,
  the local website dev server, `file:` fixtures in tests) or `PluginAppConfig.docsWebUrl`.
  
  A plugin can now also ship its own landing page: when `src/pages/index.*` exists, Astro renders it
  at `/` (the docs shell and the legacy `.html` redirects are released to Astro), while the machine
  routes (`/plugin.json`, `/mcp`, `/api/*`, OAuth, skills/agents) always stay served. Detected at
  config time — restart the dev server after adding or removing the page.
  
  `/assets/*` is no longer claimed by the plugin server: docs assets load from the shell's origin,
  and a plugin's own `public/assets/` files are served by Astro like any other static assets.
- f9e9208: Build-time file map: the artifacts module now carries the `skills/` and `agents/` trees
  (`files: PluginFileMapEntry[]`, text inlined as UTF-8, binaries base64), and the runtime prefers
  it everywhere — skill discovery, skill files and zip downloads (`skillsFromFileMap`), agent
  discovery and markdown (`agentsFromFileMap`), and `/plugin.zip` (assembled from the map plus the
  injected README). Directory walks remain the fallback for dev, tests and Node hosts.
  
  With this, a deployed plugin needs no files on disk at all: serverless functions require no
  `includeFiles`-style configuration, and a plugin serves fully under Cloudflare's Workers runtime
  (verified with `wrangler dev` — tools, MCP, skills, agents, zips, widgets and the docs shell).
  The docs-shell fetch also gained a 10-second timeout so an unreachable shell URL fails the docs
  page soft instead of hanging requests.

### Patch Changes

- f9e9208: Resolve the plugin root at runtime instead of trusting the baked build-time path. `getAnonApp` / `getAuthApp` now run the configured `pluginRootFolder` through `Helpers.resolvePluginRoot`: a `QRTL_PLUGIN_ROOT` env var wins, a configured folder is used only when it exists on disk, and otherwise the root falls back to `process.cwd()`. This makes the runtime work on serverless platforms (Vercel, Netlify) that build the app in one directory and run it in another.

## 0.8.0

### Minor Changes

- 8b460f9: Docs-site login: authenticated plugins get a **Log in** button in the docs top bar, running the same OAuth flow MCP clients use (authorization code + PKCE with a CIMD client). The plugin serves its own client metadata document at `/.well-known/oauth/client-metadata.json`; `/oauth/login` starts the flow and `/oauth/callback` exchanges the code server-side, so no authorization-server CORS is needed. On localhost the shared metadata document on plugin.quartal.com is the client. The token is injected into Swagger UI *Try it out* requests; the Swagger security scheme is now plain HTTP bearer (the OAuth2 password flow and the `swagger-test-client` default are removed). `OAUTH_CLIENT_ID` now names a pre-registered public client for the docs login in `custom` mode (Auth0 / Entra ID, which lack CIMD).
- 8b460f9: Auth modes reworked: the authenticated mode is now `auth: "quartal-hub"`. It is zero-config — fixed Quartal Hub test-environment scope (`quartal-hub-test`), audience (`https://hub.test.qrtl.com`) and issuer, with only `OAUTH_ISSUER` overridable; the RFC 9728 `resource` derives from each request's origin so localhost and deployed instances need no configuration. A new `auth: "custom"` mode connects to any OAuth2 / OIDC server (Auth0, Microsoft Entra ID, …) via the `OAUTH_*` environment variables; `OAUTH_ISSUER` is required there. The `resolveOAuthOptions` / `oauthAuthMiddleware` second parameter is now the auth mode instead of a plugin name, and per-plugin-name scope/resource derivation is removed.

### Patch Changes

- 9422615: Docs site: hide Swagger UI's Authorize button and per-operation lock icons for authenticated plugins. The docs-site top-bar login now provides the bearer token (injected into Try-it-out requests), so Swagger's own auth controls were redundant and confusing.

## 0.7.0

### Minor Changes

- aed3d80: Align plugin outputs with the Agent Plugins 1.0 standard: `GET /plugin.json` serves the standard
  manifest (the Quartal overview moved to `GET /com.quartal.plugin/contents.json`), `GET /mcp.json`
  serves the standard `mcpServers` config, and `GET /plugin.zip` serves the whole installable
  package (dual Claude manifests, skills, agents, README, Quartal extension). MCP list results are
  also mirrored as REST (`GET /mcp/tools.json`, `/mcp/prompts.json`), and a plugin can declare
  multiple named MCP servers — hosted at `/mcp/<name>` or external — via the `mcp.servers` section
  of `qrtl.config`. `@quartal/plugin-core` carries the new manifest and multi-server model types.
- aed3d80: `qrtl.config.ts` is now the single source of plugin configuration. The `qrtlPlugin()` Astro
  integration reads the auth mode from `qrtl.config` — the `qrtlPlugin({ auth })` option is
  deprecated (it still wins when passed, with a warning) — fails the build when a config file
  exists but cannot be loaded instead of silently falling back to anonymous, and watches the config
  file so edits restart the dev server. Every `package.json` identity field (`version`, `license`,
  `homepage`, `author`, `repository`, `keywords`, in addition to the existing `name` and
  `description`) can now also be set in `qrtl.config`, which takes precedence; `package.json` is
  the fallback.

### Patch Changes

- Updated dependencies [aed3d80]
  - @quartal/plugin-core@0.7.0

## 0.6.1

### Patch Changes

- 97dc6c5: Baseline release of every published package to verify the upgraded release pipeline
  (changesets/action v2) pushes git tags and creates GitHub Releases on publish.
- Updated dependencies [97dc6c5]
  - @quartal/plugin-core@0.6.1

## 0.6.0

### Minor Changes

- e4c8a90: Add the `@visibility` JSDoc tag for tools (MCP Apps `_meta.ui.visibility`): `model` and/or `app`
  scopes, advertised in `tools/list` so hosts can hide widget-only helper tools from the model.
  New `McpToolVisibility` type and optional `visibility` on `McpToolDescriptor` / `CodeFunction`.

### Patch Changes

- Updated dependencies [e4c8a90]
  - @quartal/plugin-core@0.6.0

## 0.5.2

### Patch Changes

- 844f6df: Readme images updated

## 0.5.1

### Patch Changes

- 3922e86: Remove leftovers from the project's Deno/JSR era.
  
  `@quartal/plugin-core` drops `deno.jsonc` and is now a plain pnpm TypeScript package. Its README
  documents that the package has, and must keep, no runtime dependencies: it sits at the bottom of the
  dependency graph for every other `@quartal` package and is consumed from server, browser, and
  bundler contexts alike.
  
  Documentation and comments across the other packages no longer describe the Deno-era toolchain.
  Published READMEs are affected, hence the version bumps; there are no code changes.
- 3922e86: Regenerate the package README from the docs vault: adds the Prompts artifact type and Agents to the
  artifact lists, links the plugin template repository, and replaces the header image with a cropped
  version. Removes a duplicated Getting Started section.
- Updated dependencies [3922e86]
  - @quartal/plugin-core@0.5.1
