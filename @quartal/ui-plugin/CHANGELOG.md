# @quartal/ui-plugin

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

## 0.7.0

### Minor Changes

- aed3d80: The plugin docs SPA shows all MCP servers of a plugin: the front-page server list, the left-navi
  server count, and a server table in the MCP view with copyable absolute endpoint URLs.

## 0.6.2

### Patch Changes

- 97dc6c5: Baseline release of every published package to verify the upgraded release pipeline
  (changesets/action v2) pushes git tags and creates GitHub Releases on publish.

## 0.6.1

### Patch Changes

- 3922e86: Remove leftovers from the project's Deno/JSR era.
  
  `@quartal/plugin-core` drops `deno.jsonc` and is now a plain pnpm TypeScript package. Its README
  documents that the package has, and must keep, no runtime dependencies: it sits at the bottom of the
  dependency graph for every other `@quartal` package and is consumed from server, browser, and
  bundler contexts alike.
  
  Documentation and comments across the other packages no longer describe the Deno-era toolchain.
  Published READMEs are affected, hence the version bumps; there are no code changes.

## 0.6.0

### Minor Changes

- da3bb93: Move `vue` and `vue-router` from `dependencies` to `peerDependencies`.
  
  Both are rollup externals in the library build, so the published bundle imports
  them rather than embedding them. Declaring them as runtime dependencies gave
  consumers a second copy of each, which breaks the things that depend on a single
  shared instance: Vue reactivity across the component boundary, and `vue-router`'s
  `inject` keys behind `useRoute()` and `RouterLink`.
  
  Consumers already using this package with Vue 3.5+ and vue-router 4.6+ need no
  change; the packages they were installing transitively are now peers they supply.
