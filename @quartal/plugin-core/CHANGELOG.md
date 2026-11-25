# @quartal/plugin-core

## 2.0.0-beta.0

### Major Changes

- bd98c1f: Skills over MCP.
  
  - The main MCP server serves the plugin's `skills/` folder with the MCP Skills extension (`io.modelcontextprotocol/skills`): `skills/list`, `skills/get` and the `skill://<name>/<path>` resources, each skill with a SHA-256 file manifest. Skills are validated by the SDK's skill catalog (name equals folder, frontmatter, 512 files / 16 MiB); an invalid skill is left out with a warning.
  - `GET /mcp/skills.json` mirrors `skills/list`. Skill files stay available at `/skills/<name>/<path>` and `/skills/<name>.zip`. There is no `/skills/catalog.json` and no `.skill` download.
  - The MCP server is built on the SDK's `McpServer`; widgets are one `ui://widgets/{toolId}.html` resource template.
  - `@quartal/plugin-core`: `ListSkillsResult`, `McpSkill`, `McpSkillResource` and `SkillFrontmatter` describe the MCP shapes; `PluginClient.getMcpSkills()` fetches the mirror and `skillHttpUrls()` maps an entry to its HTTP files and zip. `PluginLinks.skills` replaces `skillsCatalog`. `discoverSkills(baseDir)` and `skillsFromFileMap(files)` return `SkillEntry[]`; `registerSkillRoutes(app, root, { fileMap })` no longer takes a manifest.
- bd98c1f: Version 2: Quartal Plugins on the stateless MCP 2026-07-28 feature set — skills over MCP, elicitation, general resources and Quartal Files references. Published as `2.0.0-beta.N` under the npm `beta` tag; the starter kit scaffolds plugins on `^2.0.0-beta.0`.

### Minor Changes

- bd98c1f: Asking the user mid-call (MCP elicitation).
  
  - `@quartal/plugin/elicit`: `elicitForm<T>(ctx, key, { message })` asks with a form and `elicitUrl(ctx, key, { message, url })` asks the user to open a page. Both are stateless (MCP 2026-07-28 input-required results): the client retries the call with the answer and the method runs again.
  - The code generator builds the form schema from `T` (flat object of strings, numbers, booleans, string-literal unions and arrays of one; JSDoc becomes the label) into `elicitations` on the tool descriptor, and fails the build for a type a form cannot express.
  - A client without elicitation, or a 2025-era client, gets the fallback: `decline` by default, or an error with `fallback: "error"`.
  - REST: with `Qrtl-Elicitation: form|url`, a tool that asks answers HTTP 428 with `inputRequests`; the retry carries the answers in `Qrtl-Input-Responses` (base64url JSON). `open-api.json` documents the 428.
  - Every tool method now receives a context as its second parameter, also without authentication (`{ authenticated: false }`).
  - `@quartal/plugin-core`: `CodeElicitation`, `CodeFunction.elicitations` and `McpToolDescriptor.elicitations`.
- bd98c1f: Files in and out of tools with the MCP files extension (`io.modelcontextprotocol/files`, experimental).
  
  - `@quartal/plugin/files`: an `McpFile` tool input property is marked `x-mcp-file` (`@accept`, `@maxSize`, `@requireDigest` from JSDoc); `readMcpFile(ctx, file)` returns the bytes the framework received and checked (size, type, SHA-256) before the tool ran; `offerDownload(ctx, …)` lists a download in the result's `_meta` for clients that support downloads.
  - Files arrive inline (base64 `data`, up to 4 MiB per call) or through the plugin's file staging: export `fileStaging` from `src/file-staging.ts` and set `QRTL_REQUEST_STATE_SECRET`; the first `tools/call` answers `upload_required` with the targets and a sealed request state, and the retry runs the tool with the staged bytes. The extension is declared in `server/discover`.
  - A `FileStaging` gets the tool's arguments and the caller's context, and may `confirm` an upload (storage-side size and digest check) instead of `read`ing it; the tool then finds the staged key with `stagedFileKey(ctx, file)`.
  - REST accepts `McpFile` arguments inline.
  - `@quartal/plugin-core`: `CodePropOrParam.file`.
- bd98c1f: The plugin's own MCP resources.
  
  - Methods of classes exported from `src/resources/mod.ts` are MCP resources: `@uri` gives the URI (a URI with `{variables}` is a resource template whose variables are the method's input properties), `@mimeType` the content type and `@cache 5m [public]` the cache hint. A string is served as text, bytes as a blob, `{ text | blob, mimeType }` as given, anything else as JSON (`application/json`). Without `@mimeType`, the listed MIME type is inferred from the method's return type.
  - The code generator writes `mcp-resources.json` and `resources.registry.ts`; the generated middleware passes `resourceModules` to the app. A method without `@uri`, a duplicate URI or a template variable missing from the input fails the build.
  - Resources are served on the main MCP server next to widgets and skills, and listed in `GET /mcp/resources.json` and the plugin overview.
  - Prompts and resources receive the call's context as their second parameter, like tools.
  - `@quartal/plugin-core`: `McpResourceDescriptor`, `McpResourcesDocument`, `CodeResourceDeclaration` and `CodeFunction.resource`.

## 1.1.0

### Minor Changes

- 042778d: `PluginClient.getMcpTools()` fetches `GET /mcp/tools.json`, the main MCP server's `tools/list` result, typed as `ListToolsResult`. New types: `Tool`, `ToolObjectSchema`, `ListToolsResult` and `McpToolUiMeta` (the MCP Apps `_meta.ui` of a tool). A request that the plugin answers with an error status throws a `PluginClientError`, which carries the requested `path` and the HTTP `status`.

## 1.0.1

### Patch Changes

- 849fde1: README updates for the 1.0 release: the package README describes what 1.0 ships, points to plugin.quartal.com for the full documentation, and notes that generating a Claude plugin and a ChatGPT plugin is planned for 1.1; other package READMEs no longer reference unpublished paths or packages.

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

## 0.8.0

### Minor Changes

- 5af1ae2: Tools can declare how they behave with the `@readOnly`, `@destructive`, `@idempotent` and `@openWorld` JSDoc tags
  (`@destructive false` and the like set a hint to false). They are advertised in the MCP `tools/list` result as the
  standard tool `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`). Without them a
  host has to assume that every tool may change or delete data, and a host such as Claude asks the user to approve
  each call; a tool marked `@readOnly` can run without that prompt. `McpToolAnnotations` is exported from
  `@quartal/plugin-core`. The tools guide documents the tags, and the `AGENTS.md` of a new plugin tells coding agents to
  mark tools that only read.

## 0.7.0

### Minor Changes

- aed3d80: Align plugin outputs with the Agent Plugins 1.0 standard: `GET /plugin.json` serves the standard
  manifest (the Quartal overview moved to `GET /com.quartal.plugin/contents.json`), `GET /mcp.json`
  serves the standard `mcpServers` config, and `GET /plugin.zip` serves the whole installable
  package (dual Claude manifests, skills, agents, README, Quartal extension). MCP list results are
  also mirrored as REST (`GET /mcp/tools.json`, `/mcp/prompts.json`), and a plugin can declare
  multiple named MCP servers — hosted at `/mcp/<name>` or external — via the `mcp.servers` section
  of `qrtl.config`. `@quartal/plugin-core` carries the new manifest and multi-server model types.

## 0.6.1

### Patch Changes

- 97dc6c5: Baseline release of every published package to verify the upgraded release pipeline
  (changesets/action v2) pushes git tags and creates GitHub Releases on publish.

## 0.6.0

### Minor Changes

- e4c8a90: Add the `@visibility` JSDoc tag for tools (MCP Apps `_meta.ui.visibility`): `model` and/or `app`
  scopes, advertised in `tools/list` so hosts can hide widget-only helper tools from the model.
  New `McpToolVisibility` type and optional `visibility` on `McpToolDescriptor` / `CodeFunction`.

## 0.5.1

### Patch Changes

- 3922e86: Remove leftovers from the project's Deno/JSR era.
  
  `@quartal/plugin-core` drops `deno.jsonc` and is now a plain pnpm TypeScript package. Its README
  documents that the package has, and must keep, no runtime dependencies: it sits at the bottom of the
  dependency graph for every other `@quartal` package and is consumed from server, browser, and
  bundler contexts alike.
  
  Documentation and comments across the other packages no longer describe the Deno-era toolchain.
  Published READMEs are affected, hence the version bumps; there are no code changes.
