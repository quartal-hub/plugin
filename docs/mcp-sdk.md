# MCP SDK versions in this repo

Every MCP dependency is on the v2 generation of the TypeScript SDK (the split `@modelcontextprotocol/*` packages, [2026-07-28 spec line](https://ts.sdk.modelcontextprotocol.io/v2/)):

| Package | Used by | Role |
|---|---|---|
| `@modelcontextprotocol/server` | `@quartal/plugin` (`PluginMcpHelper`) | Serves `/mcp`: method-string handlers, `createMcpHandler` per-request serving (2026-07-28 + stateless legacy fallback). |
| `@modelcontextprotocol/client` | `@quartal/ui-plugin` (docs-site tool tester), `@quartal/plugin` tests | Streamable HTTP client; also the peer `@modelcontextprotocol/ext-apps` needs at runtime, which is why `@quartal/plugin` lists it as a dependency. |
| `@modelcontextprotocol/ext-apps` 2.x | widget runtime (`@quartal/plugin/widget`), `@quartal/plugin-embed` conformance tests | MCP Apps: the widget-side `App`. Its 2.x line is built on the v2 SDK; the `ui/*` wire protocol is unchanged from 1.x, so a 2.x widget runs in a 1.x host and vice versa. |

`@quartal/plugin-embed`'s host (`createWidgetHost`) has no SDK dependency at all: it speaks the postMessage protocol directly.

## Protocol version note

`@modelcontextprotocol/server` supports **both protocol eras**, negotiated by two separate mechanisms — `LATEST_PROTOCOL_VERSION` (`2025-11-25`) governs only the legacy `initialize` handshake and will never name a 2026 revision:

- **Legacy (≤ 2025-11-25)**: the `initialize` handshake, `SUPPORTED_PROTOCOL_VERSIONS` down to `2024-11-05` — today's clients (Claude, Inspector, MCPJam) connect this way.
- **Modern (2026-07-28)**: per-request `_meta` envelope + `server/discover`, `SUPPORTED_MODERN_PROTOCOL_VERSIONS` (kept deliberately separate in the SDK so a modern version string can never leak into a 2025 handshake).

`PluginMcpHelper` serves both through `createMcpHandler(factory)`: modern exchanges get a fresh per-request `Server` from the factory; legacy requests are answered by the handler's built-in stateless fallback using the same factory (`legacy: 'stateless'`, the default — the same no-session-id idiom as the previous `WebStandardStreamableHTTPServerTransport` wiring). Deprecations that matter on the modern path: `logging/setLevel` never arrives (2026 clients pass `logLevel` per request in `_meta`; the declared `logging` capability still backs legacy clients), and push-style `elicitInput()`/`requestSampling()` throw on 2026-era requests — return `inputRequired(...)` from handlers instead (not currently used by this repo).
