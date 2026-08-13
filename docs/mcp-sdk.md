# MCP SDK versions in this repo

This repo intentionally uses **two generations of the MCP TypeScript SDK side by side**. They are different npm packages, so they coexist without conflict. Do not "clean up" the seemingly duplicate dependency.

| Package | Generation | Used by | Why |
|---|---|---|---|
| `@modelcontextprotocol/server` (v2) | v2 rewrite, [2026-07-28 spec line](https://ts.sdk.modelcontextprotocol.io/v2/) | `@quartal/plugin` server (`PluginMcpHelper`) | The maintained release line; method-string handlers, Web-standard Streamable HTTP transport. |
| `@modelcontextprotocol/client` (v2) | v2 | `@quartal/plugin` tests only (dev dependency) | Drives the e2e MCP tests. |
| `@modelcontextprotocol/sdk` (v1) | v1 (1.x) | `@modelcontextprotocol/ext-apps` (peer `^1.29.0`), `@quartal/ui-plugin`, widget runtime (`@quartal/plugin/widget`) | **MCP Apps (`ext-apps`) has hard runtime imports of the v1 SDK** (`Protocol`, Zod schemas) in every entry point — the widget bridge and the host bridge. Its own v2 migration is tracked upstream in [ext-apps#702](https://github.com/modelcontextprotocol/ext-apps/issues/702). |

## Why this works

The coupling between the v2 server and the v1-based widgets is **wire-protocol only**: a widget's `App` talks postMessage to the host (Claude, MCPJam), and the host talks MCP over HTTP to our server. No SDK classes cross that boundary — the server advertises widgets as plain JSON (`_meta.ui.resourceUri` on tools, `resources/read` for the HTML). The MCP e2e and widget tests exercise exactly this combination.

## Protocol version note

`@modelcontextprotocol/server` 2.0.0 implements the 2026-07-28 SDK architecture, but its negotiated **wire protocol still tops out at `2025-11-25`** (same list as sdk v1 1.30, down to `2024-11-05` — so today's clients keep connecting). The 2026-07-28 wire negotiation will arrive in a later 2.x; when upgrading to it, review the deprecations that become load-bearing (the `logging` capability / `setLevel`, and push-style elicitation being replaced by `input_required` results).

## When ext-apps ships v2 support

Once [ext-apps#702](https://github.com/modelcontextprotocol/ext-apps/issues/702) lands in a release, `@quartal/ui-plugin` and the widget runtime can migrate too, and the v1 `@modelcontextprotocol/sdk` dependency can be removed everywhere.
