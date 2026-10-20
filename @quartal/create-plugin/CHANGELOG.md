# @quartal/create-plugin

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

## 0.8.3

### Patch Changes

- 5af1ae2: Tools can declare how they behave with the `@readOnly`, `@destructive`, `@idempotent` and `@openWorld` JSDoc tags
  (`@destructive false` and the like set a hint to false). They are advertised in the MCP `tools/list` result as the
  standard tool `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`). Without them a
  host has to assume that every tool may change or delete data, and a host such as Claude asks the user to approve
  each call; a tool marked `@readOnly` can run without that prompt. `McpToolAnnotations` is exported from
  `@quartal/plugin-core`. The tools guide documents the tags, and the `AGENTS.md` of a new plugin tells coding agents to
  mark tools that only read.

## 0.8.2

### Patch Changes

- 671b588: Codegen describes every type that a tool signature reaches, also one that `src/tools/mod.ts` does not export. A
  type declared under `src/tools/` but not exported from `mod.ts` (or a subtype of an exported type that is not
  exported) used to resolve to an empty schema without a message; it now gets its properties and JSDoc descriptions
  in `open-api.json` and the MCP tool schemas like any other type. The tools documentation has a new "Where the
  types live" section, and the `AGENTS.md` of a new plugin tells coding agents where the tool types go.

## 0.8.1

### Patch Changes

- 4c9905b: Scaffolded plugins now depend on `@quartal/plugin@^0.9.0` and `@quartal/plugin-vue@^0.5.7`. The
  `^0.8.0` range resolved to 0.8.0, whose runtime reads plugin files from disk and answers 500 on
  every route when deployed to Vercel or Cloudflare Workers.

## 0.8.0

### Minor Changes

- 8b460f9: Scaffolded plugins now use `auth: "quartal-hub"` and depend on `@quartal/plugin@^0.8.0` / `@quartal/plugin-core@^0.7.0` — the previously published scaffolder still emitted `^0.6.0` ranges.

## 0.7.0

### Minor Changes

- aed3d80: Non-interactive scaffolding for CI and coding agents: every starter-kit question now has a CLI
  flag (`--description`, `--auth`/`--no-auth`, `--sample-tool`/`--no-sample-tool`, `--widgets`),
  `--yes` accepts the defaults for the rest, and `--help` prints the usage. Scaffolded projects
  now include an `AGENTS.md` that briefs coding agents on the project conventions.

### Patch Changes

- aed3d80: Scaffolded projects configure the auth mode only in `qrtl.config.ts`; the generated
  `astro.config.mjs` uses the bare `qrtlPlugin()` integration.

## 0.6.1

### Patch Changes

- 97dc6c5: Baseline release of every published package to verify the upgraded release pipeline
  (changesets/action v2) pushes git tags and creates GitHub Releases on publish.

## 0.6.0

### Minor Changes

- 132e89d: New `@quartal/create-plugin` starter kit: `pnpm create @quartal/plugin` scaffolds a plugin project,
  asking for name, description, Quartal Hub authentication (OAuth2 vs `anon`), a sample
  tool, and a widget framework (None / Vue / React / Plain JavaScript).
