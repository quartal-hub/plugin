# Plan: Align plugin outputs with Agent Plugins 1.0

> **Status: PLAN (2026-09).** This document proposes a rewrite of the plugin's generated outputs
> and HTTP metadata endpoints. Nothing here is implemented yet. Backward compatibility is not a
> constraint: `PluginClient`, the docs SPA, the samples and the couple of Salaxy projects that use
> the plugin are updated by hand when this lands.
>
> Companion plan: the Quartal Hub multi-target publishing plan (maintained in the Hub project).

## Why

Quartal Plugins currently emit invented metadata shapes (the generated `qrtl-plugin/` folder,
`/plugin.json` serving `PluginInfo`, skill/agent catalogs). The industry has consolidated on
**[Agent Plugins 1.0](https://agent-plugins.org/specification)** (published 2026-08-06;
TSC: Amazon, Cursor, Microsoft, OpenAI, Vercel, Google — Anthropic absent but content-compatible
via `.claude-plugin/`): a plugin is a directory with a `plugin.json` manifest, a `skills/` folder
(Agent Skills / `SKILL.md`, which we already use) and an `mcp.json` declaring MCP servers.
Launch clients: ChatGPT/Codex, VS Code/GitHub Copilot (GA), Cursor, Kiro, Google's Agents CLI.

The goal of this rewrite: **every Quartal-invented shape is replaced by a well-established
standard where one exists** — Agent Plugins for packaging, MCP-native shapes for tool/prompt/
resource metadata, OpenAPI for the REST API (unchanged) — and genuinely Quartal-specific
concepts move under the spec's extension mechanism (`com.quartal.plugin` reverse-domain
namespace).

## Current outputs

### Generated `qrtl-plugin/` folder

Built by `@quartal/plugin/src/code/generateTools.ts` → `buildPluginArtifacts.ts`, triggered by the
Vite plugin `qrtlCodegenPlugin.ts`. Gitignored, regenerated on change.

| File | Shape | Standard? |
|---|---|---|
| `contents.json` | `PluginInfo` (name, title, version, style, tools[], toolGroups[], skills[], agents[], widgets[], prompts[], links) — served as `/plugin.json` | ❌ invented |
| `mcp-tools.json` | `{tools: McpToolDescriptor[]}` (id, fileName, className, methodName, description, inputSchema, outputSchema, visibility) | ❌ invented (near-MCP) |
| `mcp-prompts.json` | `{prompts: McpPromptDescriptor[]}` | ❌ invented (near-MCP) |
| `open-api.json` | OpenAPI 3.0 document (`POST /api/<Class>/<method>` per tool) | ✅ OpenAPI |
| `tools.json` | `{files: CodeFile[]}` — full TS introspection | ❌ invented (internal use) |
| `types.json` | `CodeType[]` flat array | ❌ invented (internal use) |
| `tools.registry.ts`, `prompts.registry.ts` | static import maps for bundling | internal only |

### HTTP endpoints (registered in `@quartal/plugin/src/hono-app/`)

| Endpoint | Returns | Standard? |
|---|---|---|
| `GET /plugin.json` | `PluginInfo` (= `contents.json`) | ❌ invented; **name collides with the Agent Plugins manifest** |
| `GET /mcp-server.json` | MCP `Implementation`-like info | ~ near-MCP |
| `GET /open-api.json` | OpenAPI 3.0 | ✅ |
| `ALL /mcp`, `/mcp/*` | MCP streamable HTTP (`@modelcontextprotocol/server` v2; `tools` always, `resources` when widgets exist, `prompts` when prompts exist) | ✅ MCP |
| `POST /api/<Class>/<method>` | REST tool execution (Zod-validated) | ✅ (OpenAPI-described) |
| `GET /skills/catalog.json`, `/skills/<name>.zip\|.skill`, `/skills/:name/SKILL.md`, `/skills/:name/*` | skills catalog + files | catalog ❌ invented; `SKILL.md` ✅ Agent Skills |
| `GET /agents/catalog.json`, `/agents/<name>.md\|.json` | agents catalog + files | catalog ❌ invented; format = Claude |
| `GET /types.json`, `/readme.md`, `/icons/:index`, `/favicon.ico`, `/widget-assets/*`, docs SPA at `/`, `public/` catch-all | supporting | — |
| `GET /.well-known/oauth-protected-resource[...]` (auth mode) | RFC 9728 metadata | ✅ |
| `/widgets/<toolId>` (Astro, not Hono) | MCP Apps widget pages (`ui://` resources) | ✅ SEP-1865 |

### Gaps

- No installable bundle manifest exists anywhere — the served `/plugin.json` is an overview, not
  a package manifest.
- One plugin = one Astro project = one MCP server at `/mcp`.
- Grouping is only class-derived (`PluginToolGroup` / OpenAPI tags).
- External MCP servers are declarable only inside agent files (`AgentMcpServer`), as pass-through
  data for the host.
- Auth modes: `anon` | `quartal-iam`.

## Proposed target

**Principle: a Quartal plugin's distributable form IS an Agent Plugin 1.0 package, and the HTTP
origin mirrors that package path-for-path.** The REST API stays OpenAPI. MCP metadata uses
MCP-native wire shapes. Only genuinely Quartal concepts live under the `com.quartal.plugin`
extension namespace.

### New generated package (`dist/agent-plugin/`, downloadable as `/plugin.zip`)

| File | Shape | Notes |
|---|---|---|
| `plugin.json` | Agent Plugins 1.0 manifest: `$schema` (`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`), `name` (lowercase, 1–64 chars), `version`, `description`, `author` `{name,email,url}`, `homepage`, `repository`, `license`, `keywords`, `extensions` | derived from `package.json` + `qrtl.config` |
| `mcp.json` | `{"$schema": ".../mcp.schema.json", "mcpServers": {"<name>": {"type": "streamable-http", "url": "...", "headers": {...}}}}` | points at the plugin's own hosted `/mcp` plus any external servers — **multi-server and external-URL support come free from the spec** |
| `skills/<name>/SKILL.md` (+ files) | Agent Skills | copied as-is (already compliant; spec discovers immediate children of `skills/` only) |
| `.claude-plugin/plugin.json` + `.mcp.json` | Claude dual manifest (same content, Claude's locations) | VS Code accepts these too; Claude Code needs them |
| `agents/` | Claude agent format | Claude-only extra; other clients ignore unknown content |
| `com.quartal.plugin/contents.json` | the rich Quartal overview (today's `PluginInfo`, revised) | extension-namespace directory per spec |
| `extensions["com.quartal.plugin"]` in `plugin.json` | `{"api": {"openapi": "<origin>/open-api.json"}, "widgets": ..., "hub": ...}` | the REST API is described by OpenAPI and only *referenced* here — never re-encoded in plugin semantics |

### New HTTP endpoints (breaking; origin mirrors the package, plus an MCP REST mirror)

| Endpoint | Returns | Source of truth |
|---|---|---|
| `GET /plugin.json` | **the Agent Plugins 1.0 manifest** (breaking change: no longer `PluginInfo`) | package |
| `GET /mcp.json` | the standard `mcpServers` config | package |
| `GET /plugin.zip` | the whole installable Agent Plugin | package |
| `GET /skills/<name>/SKILL.md` etc. | unchanged (already mirrors the package layout) | package |
| `GET /com.quartal.plugin/contents.json` | Quartal overview (docs SPA switches to this from the old `/plugin.json`) | package |
| `GET /open-api.json`, `POST /api/...` | unchanged (OpenAPI) | runtime |
| `ALL /mcp` (+ `/mcp/<server>` for multi-server, see below) | MCP streamable HTTP | runtime |
| **`GET /mcp/tools.json`, `/mcp/prompts.json`, `/mcp/resources.json`** | **REST mirror of MCP**: byte-equivalent to `tools/list` / `prompts/list` / `resources/list` results, MCP-native `Tool`/`Prompt`/`Resource` shapes incl. `_meta.ui` | runtime — same code path as the MCP handlers, so it can never drift |
| `GET /mcp-server.json` | MCP `Implementation` + declared capabilities, aligned with the MCP `initialize` result | runtime |

The REST mirror replaces the served role of `mcp-tools.json` / `mcp-prompts.json`: anything a
consumer reads over HTTP uses MCP's own shapes. The build-internal descriptor files
(`fileName`/`className` bindings, `tools.json`, `types.json`, the registries) stay internal and
deliberately unstandardized — they exist to bind metadata to code, not to be consumed.

Implementation note: the mirror routes must be registered on the Hono app *before* the
`app.all("/mcp/*")` MCP mounting in `PluginMcpHelper` so `GET /mcp/tools.json` is not swallowed by
the protocol handler.

### Where each concept comes from after the change

| Concept | Package file | HTTP | MCP protocol |
|---|---|---|---|
| Identity | `plugin.json` | `/plugin.json` | `initialize` → `serverInfo` |
| Server connection(s) | `mcp.json` | `/mcp.json` | — (it *is* the connection info) |
| Tools | — (live) | `/mcp/tools.json` | `tools/list` |
| Prompts | — (live) | `/mcp/prompts.json` | `prompts/list` |
| Widgets | — (live) | `/mcp/resources.json`, `/widgets/<id>` | `resources/list` + `resources/read` (`ui://`) |
| REST API | extension reference | `/open-api.json` | — |
| Skills | `skills/` | `/skills/…` | future: SEP-2640 `skill://` resources (watch, don't build yet) |
| Agents | `agents/` (Claude format) | `/agents/…` | — |
| Rich overview | `com.quartal.plugin/contents.json` | same path | — |

## Multiple MCP servers, external servers, proxies

`qrtl.config` gains an `mcp.servers` map. Default remains exactly one server, `main`, at `/mcp`.

```ts
export default defineQrtlConfig({
  mcp: {
    servers: {
      main: { tools: ["Calculator", "Employment"] },            // local: subset of tool classes
      reports: { tools: ["Reports"] },                          // local: second server
      crm: {                                                    // proxy: re-served through this plugin
        proxy: { type: "mcp", url: "https://crm.example.com/mcp", include: ["searchCustomers"] },
      },
      partnerApi: {                                             // proxy: REST API via its OpenAPI doc
        proxy: { type: "openapi", url: "https://api.example.com/openapi.json", include: ["getInvoice"] },
      },
      volatile: {                                               // external: never proxied
        external: { url: "https://dynamic.example.com/mcp", headers: { "x-api-key": "..." } },
      },
    },
  },
});
```

Three server kinds:

1. **Local** — a named subset of the plugin's own tool classes, mounted at `/mcp/<name>`
   (`main` also stays at `/mcp`). First-level grouping falls out of this naturally.
2. **Proxy** — tools introspected at build time from an upstream MCP server (`tools/list`) or an
   OpenAPI document (operations → tools), filtered with `include`/`exclude`, and served through
   the plugin's own `/mcp/<name>` with **harmonized Quartal auth**. Extends today's tool pipeline:
   the descriptor build gains a second source next to ts-morph, and execution dispatches an
   upstream `tools/call` / HTTP request instead of a class method. This covers both "expose an
   external MCP" and "expose an external REST API" through one mechanism.
3. **External** — NOT mounted or proxied. Emitted verbatim into the generated `mcp.json` /
   `.mcp.json`, so installing clients connect to the original URL directly. Use cases: very
   dynamic upstream servers (shape changes faster than the plugin), exotic auth,
   commercial/legal constraints, and converting an existing Claude/standard plugin into a
   Quartal plugin with additions. This generalizes the existing agent-level `AgentMcpServer`
   concept (`@quartal/plugin-core/src/model/agents/AgentMcpServer.ts`) to plugin level.

## Grouping

- **Level 1 = MCP server** (the `mcp.servers` map above). This matches how the standard itself
  groups: `mcp.json` is a named map of servers.
- **Level 2 = tool groups** — the existing class-derived `toolGroups` (also OpenAPI tags),
  unchanged.
- **Skills stay flat**: the spec only discovers immediate children of `skills/`. Optional group
  metadata can live in `com.quartal.plugin/contents.json` for Quartal surfaces.
- Neither Agent Plugins 1.0 nor the Claude/OpenAI vendor formats define grouping semantics
  beyond this; richer grouping (bundles, categories) belongs to the marketplace/Hub layer (see
  the Quartal Hub multi-target publishing plan).

## Open items to verify before implementation

1. **Remote `streamable-http` per client**: which clients actually honor a remote server URL in
   an installed plugin's `mcp.json` (test VS Code, Claude Code and Codex first). The spec allows
   it; per-client behavior is undocumented.
2. **OAuth for marketplace-installed remote MCP**: how each client runs the consent flow for an
   OAuth-protected remote server that arrived via plugin install. OpenAI's split between a
   bundled `.mcp.json` and an `.app.json` "registered connection" suggests authenticated remotes
   take a different path there.
3. **SEP-2640 (skills over MCP)**: `io.modelcontextprotocol/skills`, `skill://` resources with
   `skill://index.json` discovery — accepted but only shipped in fast-agent. Add a serving
   surface behind a feature flag once Claude Code or Codex ships support; do not build on it now.
4. Whether `mcp-server.json` should be dropped entirely in favor of the `initialize` result and
   `/plugin.json`.

## Suggested implementation phases (separate efforts, not this document)

1. Generate the Agent Plugin package (`dist/agent-plugin/` + `/plugin.zip`) alongside current
   outputs; validate against `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`.
2. Endpoint alignment: `/plugin.json` → manifest, `/mcp.json`, `/com.quartal.plugin/contents.json`,
   MCP REST mirror; update `PluginClient`, docs SPA, samples and the Salaxy projects.
3. `mcp.servers` config: local multi-server + external emission; proxy servers last.
4. Marketplace/Hub work per the companion plan.
