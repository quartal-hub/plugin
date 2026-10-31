# @quartal/plugin-core

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
