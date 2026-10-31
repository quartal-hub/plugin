# @quartal/plugin

## 1.0.0

### Major Changes

- ba40a2d: Version 1: every `@quartal/*` package moves to 1.0.0 together. The REST API changes shape, so a
  plugin built against 0.x serves different URLs after upgrading; the MCP surface gains the naming
  convention below but keeps its schemas.
  
  REST routes follow REST conventions instead of `POST /api/<Class>/<method>`. The route of a tool is
  `/api/<class>[/<segment>][/{id}]`: the class name in kebab-case, the HTTP method and segment from the
  leading verb of the method name (`get`/`list`/`find` → GET, `create` → POST, `update`/`replace` → PUT,
  `delete`/`remove` → DELETE, anything else → POST at its full name), and `{id}` for GET/PUT/DELETE when
  the input has a required primitive `id`. `Invoices.get({ id })` is `GET /api/invoices/{id}`,
  `HelloWorld.sayHello` is `POST /api/hello-world/say-hello`. A `@rest` JSDoc tag overrides the
  convention: `@rest invoicing` on a class sets the class path; `@rest [METHOD] [path]` on a method sets
  the method and/or path (a relative path is appended to the class path; a path starting with `/` is the
  full path and must start with `/api`; path parameters are written `{name}`). Path parameters and, for GET and DELETE,
  the query string carry the input properties; POST and PUT take the rest as the JSON body. GET/DELETE
  inputs and path parameters must be `string`, `number` or `boolean`, otherwise the build fails with a
  message pointing at `@rest POST`. The `defaultMethod` option of `generateTools` / `buildPluginArtifacts`
  is gone, `PluginToolExposure.restMethod` is upper-case (`"GET" | "POST" | "PUT" | "DELETE"`), and
  `CodeFunction.rest` / `CodeClass.rest` carry the declared tags. MCP tool names and schemas are unchanged.
  
  The same verbs shape the MCP side: a bare CRUD verb is completed with the class noun for the MCP tool
  name (`Invoices.get` → `getInvoice`, `Invoices.list` → `listInvoices`; a name two classes share is
  prefixed with the class on both), and the verb implies the tool annotations unless `@readOnly` & co. say
  otherwise (`get`/`list`/`find` read-only, `create` not destructive, `update` idempotent, `delete`/`remove`
  destructive and idempotent).
  
  A tool can be kept to one surface: `@rest hidden` (method or class) gives it no REST operation,
  `@mcp hidden` (method or class) leaves it out of the MCP server (`CodeFunction.mcp` / `CodeClass.mcp`).
  
  The docs site shows both surfaces side by side: its Tools page is an index of every tool with its REST
  operation and its MCP tool name, grouped by class the way Swagger UI groups operations by tag, with the
  class description, the behaviour hints as icons, a widget check mark, and a dash where a tool is hidden
  from one surface. The Tools heading in the left navigation opens that page, and its tool groups collapse
  per class. `contents.json` carries the class JSDoc as `toolGroups[].description` and each tool's resolved
  hints as `tools[].annotations`.

### Minor Changes

- 1da3ea3: Dependencies moved to their current releases. The MCP stack is now v2 throughout: the widget
  runtime uses `@modelcontextprotocol/ext-apps` 2.x, the docs site's tool tester connects with
  `@modelcontextprotocol/client`, and the v1 `@modelcontextprotocol/sdk` is no longer a dependency
  of any package. `@quartal/plugin` lists `@modelcontextprotocol/client` and `zod` as dependencies
  because ext-apps needs them at runtime. Toolchain: TypeScript 6.0, Vite 8, Vitest 5, Astro 7.4
  (which requires Node.js 22.23.4 or later), Vue Router 5, vue-tsc 3, Storybook 10.6. The
  `@quartal/create-plugin` CLI declares the same Node.js requirement.
  
  `@quartal/ui-plugin` ships a single bundled `dist/index.d.ts` again. Its types import `PluginInfo`,
  `CodeType` and the other plugin metadata types from `@quartal/plugin-core`, which is now a dependency
  of the package; the previous build wrote those imports as relative paths into the workspace sources,
  which do not exist in the published package.
- 1da3ea3: `GET /mcp-server.json` is gone. The MCP server's name, version, title, description, website and icons
  are what the MCP `initialize` result returns, and the overview at `/com.quartal.plugin/contents.json`
  lists the plugin's servers with their endpoints. `PluginLinks.mcpServer`, `PluginClient.getMcpServer()`
  and the `McpServerInfo` type are removed with it; the docs site's MCP page shows the servers table for
  every plugin instead of the separate server-info table.
- c490195: Embed a plugin's widgets in any web page. The new `@quartal/plugin-embed` package is a dependency-free
  MCP Apps host (`createWidgetHost`), a REST client for a plugin's tools (`connectPlugin`, with
  `callTool` and `mountWidget`), the `<qrtl-widget>` custom element (`@quartal/plugin-embed/element`),
  React bindings (`PluginWidget`, `usePluginTool` from `@quartal/plugin-embed/react`) and Vue bindings
  (`@quartal/plugin-embed/vue`). A widget's own tool calls reach the page first (`onToolCall` /
  `toolcall` event), which can answer them or let them run over REST with the page's bearer token.
  
  Every plugin now serves `GET /widgets.js` (the `<qrtl-widget>` module with the plugin's route table
  built in, about 5 KB gzipped), `GET /widgets/routes.json` (each tool's REST route and parameter
  placement, keyed by MCP tool id, and each widget's page), `GET /widgets/embed.md` and
  `GET /widgets/<toolId>/embed.md` (copy-paste snippets, the input type and a prompt for coding agents).
  `PluginToolExposure` gains `restPathParams` and `restInputIn`.
  
  `@quartal/ui-plugin`: the MCP tool tester previews widgets with the `@quartal/plugin-embed` host
  (`mountMcpWidget` replaces `mountWidget`; `WidgetHostHandle.host` replaces `bridge`), so the ext-apps
  `AppBridge` is no longer bundled. The docs site's Widgets page shows a live preview of each widget and
  its embedding snippets. `@quartal/create-plugin` scaffolds the new `@quartal/*` versions.
  
  A widget's height can be limited: `maxHeight` on `createWidgetHost`, `mountWidget` (plus
  `setMaxHeight`), the React and Vue `PluginWidget`, and the `max-height` attribute of `<qrtl-widget>`.
  The iframe follows the content up to the limit, and the widget gets it as
  `containerDimensions.maxHeight`. The docs preview limits widgets to 600 px, and its Embed tab shows
  the snippets in the read-only code viewer.
  
  `contents.json` records the `@quartal/plugin` version a plugin was built with
  (`PluginInfo.generator: { name, version }`), and the docs front page shows it under the plugin's name as
  "Created with @quartal/plugin, version <version>", linking to plugin.quartal.com and the version's npm
  page.

### Patch Changes

- 1da3ea3: A widget's `name` in `widgets.entries` of `qrtl.config.ts` is now its display title: the docs site,
  `/widgets/routes.json`, the embed guide and the overview's `widgets[].title` show it. Without a
  configured name the tool's title is used, as before.
- Updated dependencies [1da3ea3]
- Updated dependencies [1da3ea3]
- Updated dependencies [c490195]
- Updated dependencies [ba40a2d]
  - @quartal/plugin-embed@1.0.0
  - @quartal/plugin-core@1.0.0

## 1.0.0-beta.1

### Minor Changes

- c490195: Embed a plugin's widgets in any web page. The new `@quartal/plugin-embed` package is a dependency-free
  MCP Apps host (`createWidgetHost`), a REST client for a plugin's tools (`connectPlugin`, with
  `callTool` and `mountWidget`), the `<qrtl-widget>` custom element (`@quartal/plugin-embed/element`),
  React bindings (`PluginWidget`, `usePluginTool` from `@quartal/plugin-embed/react`) and Vue bindings
  (`@quartal/plugin-embed/vue`). A widget's own tool calls reach the page first (`onToolCall` /
  `toolcall` event), which can answer them or let them run over REST with the page's bearer token.
  
  Every plugin now serves `GET /widgets.js` (the `<qrtl-widget>` module with the plugin's route table
  built in, about 5 KB gzipped), `GET /widgets/routes.json` (each tool's REST route and parameter
  placement, keyed by MCP tool id, and each widget's page), `GET /widgets/embed.md` and
  `GET /widgets/<toolId>/embed.md` (copy-paste snippets, the input type and a prompt for coding agents).
  `PluginToolExposure` gains `restPathParams` and `restInputIn`.
  
  `@quartal/ui-plugin`: the MCP tool tester previews widgets with the `@quartal/plugin-embed` host
  (`mountMcpWidget` replaces `mountWidget`; `WidgetHostHandle.host` replaces `bridge`), so the ext-apps
  `AppBridge` is no longer bundled. The docs site's Widgets page shows a live preview of each widget and
  its embedding snippets. `@quartal/create-plugin` scaffolds the new `@quartal/*` versions.
  
  A widget's height can be limited: `maxHeight` on `createWidgetHost`, `mountWidget` (plus
  `setMaxHeight`), the React and Vue `PluginWidget`, and the `max-height` attribute of `<qrtl-widget>`.
  The iframe follows the content up to the limit, and the widget gets it as
  `containerDimensions.maxHeight`. The docs preview limits widgets to 600 px, and its Embed tab shows
  the snippets in the read-only code viewer.
  
  `contents.json` records the `@quartal/plugin` version a plugin was built with
  (`PluginInfo.generator: { name, version }`), and the docs front page shows it under the plugin's name as
  "Created with @quartal/plugin, version <version>", linking to plugin.quartal.com and the version's npm
  page.

### Patch Changes

- Updated dependencies [c490195]
  - @quartal/plugin-embed@1.0.0-beta.1
  - @quartal/plugin-core@1.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- ba40a2d: Version 1: every `@quartal/*` package moves to 1.0.0 together. The REST API changes shape, so a
  plugin built against 0.x serves different URLs after upgrading; the MCP surface gains the naming
  convention below but keeps its schemas.
  
  REST routes follow REST conventions instead of `POST /api/<Class>/<method>`. The route of a tool is
  `/api/<class>[/<segment>][/{id}]`: the class name in kebab-case, the HTTP method and segment from the
  leading verb of the method name (`get`/`list`/`find` → GET, `create` → POST, `update`/`replace` → PUT,
  `delete`/`remove` → DELETE, anything else → POST at its full name), and `{id}` for GET/PUT/DELETE when
  the input has a required primitive `id`. `Invoices.get({ id })` is `GET /api/invoices/{id}`,
  `HelloWorld.sayHello` is `POST /api/hello-world/say-hello`. A `@rest` JSDoc tag overrides the
  convention: `@rest invoicing` on a class sets the class path; `@rest [METHOD] [path]` on a method sets
  the method and/or path (a relative path is appended to the class path; a path starting with `/` is the
  full path and must start with `/api`; path parameters are written `{name}`). Path parameters and, for GET and DELETE,
  the query string carry the input properties; POST and PUT take the rest as the JSON body. GET/DELETE
  inputs and path parameters must be `string`, `number` or `boolean`, otherwise the build fails with a
  message pointing at `@rest POST`. The `defaultMethod` option of `generateTools` / `buildPluginArtifacts`
  is gone, `PluginToolExposure.restMethod` is upper-case (`"GET" | "POST" | "PUT" | "DELETE"`), and
  `CodeFunction.rest` / `CodeClass.rest` carry the declared tags. MCP tool names and schemas are unchanged.
  
  The same verbs shape the MCP side: a bare CRUD verb is completed with the class noun for the MCP tool
  name (`Invoices.get` → `getInvoice`, `Invoices.list` → `listInvoices`; a name two classes share is
  prefixed with the class on both), and the verb implies the tool annotations unless `@readOnly` & co. say
  otherwise (`get`/`list`/`find` read-only, `create` not destructive, `update` idempotent, `delete`/`remove`
  destructive and idempotent).
  
  A tool can be kept to one surface: `@rest hidden` (method or class) gives it no REST operation,
  `@mcp hidden` (method or class) leaves it out of the MCP server (`CodeFunction.mcp` / `CodeClass.mcp`).
  
  The docs site shows both surfaces side by side: its Tools page is an index of every tool with its REST
  operation and its MCP tool name, grouped by class the way Swagger UI groups operations by tag, with the
  class description, the behaviour hints as icons, a widget check mark, and a dash where a tool is hidden
  from one surface. The Tools heading in the left navigation opens that page, and its tool groups collapse
  per class. `contents.json` carries the class JSDoc as `toolGroups[].description` and each tool's resolved
  hints as `tools[].annotations`.

### Patch Changes

- Updated dependencies [ba40a2d]
  - @quartal/plugin-core@1.0.0-beta.0

## 0.11.0

### Minor Changes

- 5af1ae2: Tools can declare how they behave with the `@readOnly`, `@destructive`, `@idempotent` and `@openWorld` JSDoc tags
  (`@destructive false` and the like set a hint to false). They are advertised in the MCP `tools/list` result as the
  standard tool `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`). Without them a
  host has to assume that every tool may change or delete data, and a host such as Claude asks the user to approve
  each call; a tool marked `@readOnly` can run without that prompt. `McpToolAnnotations` is exported from
  `@quartal/plugin-core`. The tools guide documents the tags, and the `AGENTS.md` of a new plugin tells coding agents to
  mark tools that only read.

### Patch Changes

- Updated dependencies [5af1ae2]
  - @quartal/plugin-core@0.8.0

## 0.10.1

### Patch Changes

- 671b588: Codegen describes every type that a tool signature reaches, also one that `src/tools/mod.ts` does not export. A
  type declared under `src/tools/` but not exported from `mod.ts` (or a subtype of an exported type that is not
  exported) used to resolve to an empty schema without a message; it now gets its properties and JSDoc descriptions
  in `open-api.json` and the MCP tool schemas like any other type. The tools documentation has a new "Where the
  types live" section, and the `AGENTS.md` of a new plugin tells coding agents where the tool types go.

## 0.10.0

### Minor Changes

- 2593469: `qrtl.config.ts` `auth` now also takes an object form: `{ mode, issuer?, scope?, audience?, resource? }`.
  The values are app defaults for the OAuth resolution — per field, the `OAUTH_*` environment
  variables still override them, and the mode's built-ins fill whatever is left
  (`quartal-hub` keeps its zero-config test-environment values). As part of this,
  `quartal-hub` mode now honors `OAUTH_AUDIENCE`, `OAUTH_SCOPE` and `OAUTH_RESOURCE`
  in addition to `OAUTH_ISSUER`. New exports: `QrtlAuthMode`, `QrtlAuthConfig`,
  `toQrtlAuthConfig`; `resolveOAuthOptions` and `oauthAuthMiddleware` accept the
  app defaults as a third parameter.
- e7949c2: Widgets can call the plugin's own tools: `WidgetBridge.callTool(name, args)` in `@quartal/plugin/widget`
  and `callTool` on the `useExtApps` handle return the parsed tool result (and reject with the tool's error
  message), so a widget can drive `@visibility app` tools — selecting an item, paging — without the model.
- 1ca5f50: Widgets control their theme and display mode. `useExtApps` (and `connectWidget`) take `applyTheme` and
  `autoResize` options, so a widget with a fixed brand look can leave the host theme off. The bridge and the
  `useExtApps` handle report `displayMode` and `availableDisplayModes` and offer `requestDisplayMode(mode)`, for
  example to ask the host for `fullscreen` when a dialog does not fit the inline frame. A host-context change that
  carries no theme no longer resets the reported theme to light.
  
  `Helpers.getEnvVar(name, type)` reads typed environment variables (string, number, boolean; `?` makes one
  optional), and `astro dev` loads the project's `.env*` files into `process.env` for it.
  
  The default `quartal-hub` issuer is `https://iam2026.test.qrtl.com/auth/realms/quartal` (the realm path
  includes `/auth`).

### Patch Changes

- d6cb364: Logging out of the docs UI now lets you log in as a different user. `GET /oauth/login` accepts
  `?prompt=login` and forwards the standard OIDC `prompt=login` parameter to the authorization
  endpoint, forcing the IAM login screen even when an SSO session is still alive. The docs UI sets
  a session flag on Log out and sends the parameter on the next Log in, so a first login still gets
  silent SSO. The quartal-hub issuer also moves to `https://test-iam.salaxy.com/auth/realms/salaxy`
  while the new IAM environment is being set up.

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
