# MCP SDK versions in this repo

This repo intentionally uses **two generations of the MCP TypeScript SDK side by side**. They are different npm packages, so they coexist without conflict. Do not "clean up" the seemingly duplicate dependency.

| Package | Generation | Used by | Why |
|---|---|---|---|
| `@modelcontextprotocol/server` (v2) | v2 rewrite, [2026-07-28 spec line](https://ts.sdk.modelcontextprotocol.io/v2/) | `@quartal/plugin` server (`PluginMcpHelper`) | The maintained release line; method-string handlers, `createMcpHandler` per-request serving (2026-07-28 + stateless legacy fallback). |
| `@modelcontextprotocol/client` (v2) | v2 | `@quartal/plugin` tests only (dev dependency) | Drives the e2e MCP tests. |
| `@modelcontextprotocol/sdk` (v1) | v1 (1.x) | `@modelcontextprotocol/ext-apps` (peer `^1.29.0`), `@quartal/ui-plugin`, widget runtime (`@quartal/plugin/widget`) | **MCP Apps (`ext-apps`) has hard runtime imports of the v1 SDK** (`Protocol`, Zod schemas) in every entry point — the widget bridge and the host bridge. Its own v2 migration is tracked upstream in [ext-apps#702](https://github.com/modelcontextprotocol/ext-apps/issues/702). |

## Why this works

The coupling between the v2 server and the v1-based widgets is **wire-protocol only**: a widget's `App` talks postMessage to the host (Claude, MCPJam), and the host talks MCP over HTTP to our server. No SDK classes cross that boundary — the server advertises widgets as plain JSON (`_meta.ui.resourceUri` on tools, `resources/read` for the HTML). The MCP e2e and widget tests exercise exactly this combination.

## Protocol version note

`@modelcontextprotocol/server` 2.0.0 supports **both protocol eras**, negotiated by two separate mechanisms — `LATEST_PROTOCOL_VERSION` (`2025-11-25`) governs only the legacy `initialize` handshake and will never name a 2026 revision:

- **Legacy (≤ 2025-11-25)**: the `initialize` handshake, `SUPPORTED_PROTOCOL_VERSIONS` down to `2024-11-05` — today's clients (Claude, Inspector, MCPJam, sdk v1) connect this way.
- **Modern (2026-07-28)**: per-request `_meta` envelope + `server/discover`, `SUPPORTED_MODERN_PROTOCOL_VERSIONS` (kept deliberately separate in the SDK so a modern version string can never leak into a 2025 handshake).

`PluginMcpHelper` serves both through `createMcpHandler(factory)`: modern exchanges get a fresh per-request `Server` from the factory; legacy requests are answered by the handler's built-in stateless fallback using the same factory (`legacy: 'stateless'`, the default — the same no-session-id idiom as the previous `WebStandardStreamableHTTPServerTransport` wiring). Deprecations that matter on the modern path: `logging/setLevel` never arrives (2026 clients pass `logLevel` per request in `_meta`; the declared `logging` capability still backs legacy clients), and push-style `elicitInput()`/`requestSampling()` throw on 2026-era requests — return `inputRequired(...)` from handlers instead (not currently used by this repo).

## When ext-apps ships v2 support

Once [ext-apps#702](https://github.com/modelcontextprotocol/ext-apps/issues/702) lands in a release, `@quartal/ui-plugin` and the widget runtime can migrate too, and the v1 `@modelcontextprotocol/sdk` dependency can be removed everywhere.
