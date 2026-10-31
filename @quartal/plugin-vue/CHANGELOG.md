# @quartal/plugin-vue

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies [c490195]
  - @quartal/plugin@1.0.0-beta.1

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
  - @quartal/plugin@1.0.0-beta.0

## 0.6.2

### Patch Changes

- Updated dependencies [5af1ae2]
  - @quartal/plugin@0.11.0

## 0.6.1

### Patch Changes

- Updated dependencies [671b588]
  - @quartal/plugin@0.10.1

## 0.6.0

### Minor Changes

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

- Updated dependencies [2593469]
- Updated dependencies [d6cb364]
- Updated dependencies [e7949c2]
- Updated dependencies [1ca5f50]
  - @quartal/plugin@0.10.0

## 0.5.8

### Patch Changes

- Updated dependencies [4c9905b]
  - @quartal/plugin@0.9.1

## 0.5.7

### Patch Changes

- Updated dependencies [f9e9208]
- Updated dependencies [f9e9208]
- Updated dependencies [f9e9208]
- Updated dependencies [f9e9208]
  - @quartal/plugin@0.9.0

## 0.5.6

### Patch Changes

- Updated dependencies [8b460f9]
- Updated dependencies [9422615]
- Updated dependencies [8b460f9]
  - @quartal/plugin@0.8.0

## 0.5.5

### Patch Changes

- Updated dependencies [aed3d80]
- Updated dependencies [aed3d80]
  - @quartal/plugin@0.7.0

## 0.5.4

### Patch Changes

- 97dc6c5: Baseline release of every published package to verify the upgraded release pipeline
  (changesets/action v2) pushes git tags and creates GitHub Releases on publish.
- Updated dependencies [97dc6c5]
  - @quartal/plugin@0.6.1

## 0.5.3

### Patch Changes

- Updated dependencies [e4c8a90]
  - @quartal/plugin@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies [844f6df]
  - @quartal/plugin@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [3922e86]
- Updated dependencies [3922e86]
  - @quartal/plugin@0.5.1
