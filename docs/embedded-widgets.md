# Plan: embedding widgets in web pages

Status: proposal. Scope: a browser library that lets any web page (hand-written, or vibe coded
with Lovable, Claude Code, Cursor, …) call a plugin tool and show the tool's widget in an iframe,
with the widget's own tool calls surfaced to the page. The same host powers the widget preview on
the docs site, and its core is meant for Quartal Messages' chat later.

## Today

- A widget is an Astro page at `/widgets/<toolId>`. Inside it, `connectWidget()`
  (`@quartal/plugin/widget`, over `@modelcontextprotocol/ext-apps`' `App`) speaks the **MCP Apps
  protocol**: JSON-RPC 2.0 over `postMessage` to `window.parent` (`ui/initialize`,
  `ui/notifications/tool-input`, `…/tool-result`, `…/host-context-changed`, `…/size-changed`,
  `tools/call`, `ui/open-link`, `ui/message`, `ui/update-model-context`, `ui/request-display-mode`).
- MCP hosts (Claude, ChatGPT, MCPJam) read the page as a `ui://widgets/<toolId>.html` resource and
  render it in their own sandbox; `runtimeWidgets.ts` rewrites asset URLs for that.
- The docs SPA's tool tester (`@quartal/ui-plugin` `McpToolTester` → `McpWidget` →
  `mcpWidgetHost.ts`) is a full host: MCP SDK `Client` over streamable HTTP plus ext-apps'
  `AppBridge`, widget HTML in `srcdoc`. The Widgets view itself only links to the bare page.
- `/api/*` already has `cors({ origin: "*" })` and bearer-token auth; widget pages are public and
  send no framing restrictions, so a foreign page can already iframe them.

## Decisions

### 1. The page calls the plugin over REST, not MCP

The embedding page needs one thing from the server: "run tool X with these arguments, give me
JSON". REST does that with one `fetch`; MCP needs a lot more machinery around it:

| | REST (`/api/…`) | MCP from the browser |
|---|---|---|
| Per call | 1 request | `initialize` + `notifications/initialized` + `tools/call` (session reuse needs `mcp-session-id` exposed via CORS and sticky state — awkward on serverless) |
| Library weight | `fetch` | MCP SDK client + zod; ext-apps `AppBridge` alone is **388 KB minified / 81 KB gzipped** (measured, ext-apps 1.7.5) |
| Result shape | the tool's typed JSON, documented in `open-api.json` | `CallToolResult` envelope (`content[]`, `structuredContent`, `isError`) to unwrap |
| Auth | `Authorization: Bearer` from whatever login the page has | same header, but MCP's discovery flow (RFC 9728, DCR/CIMD) is built for MCP clients, not web apps |
| Familiar to vibe-coding tools | yes — fetch + OpenAPI is their bread and butter | rarely |

MCP in the browser does work out of the box — the docs tester proves it with the SDK's
`StreamableHTTPClientTransport`, and `@mcp-ui/client` offers React renderers for MCP Apps hosts —
but it buys nothing an embedding page needs and costs an order of magnitude in bundle size. The
library keeps a pluggable `callTool`, so an MCP-backed host (docs tester, Messages) can still
supply its own.

### 2. Page ↔ widget stays the MCP Apps protocol, unchanged

Widgets are written once and must keep working in Claude/ChatGPT. So the embedding library is
simply **another MCP Apps host**: it answers `ui/initialize`, sends `tool-input` / `tool-result` /
`host-context-changed`, and handles the widget's requests. No widget code changes.

### 3. A lite host, not `AppBridge`

The host side of the subset we need is small: one `message` listener, a JSON-RPC
request/response map, ~10 methods. A hand-written host is a few KB gzipped with **zero
dependencies**, versus 81 KB for `AppBridge` + SDK + zod. The cost is tracking the protocol
ourselves; that is covered by **conformance tests that run the real ext-apps `App` against the lite
host** (the widget side already pins the ext-apps version, so a protocol bump shows up as a failing
test, not a silent break). Size budget: `widgets.js` ≤ 10 KB gzipped.

### 4. `src`, not `srcdoc`, for plugin widgets

The embedding iframe loads `https://<plugin>/widgets/<toolId>` directly. The widget then runs on
the plugin's own origin: assets load normally (no URL rewriting), the plugin's CSP headers apply,
and `allow-same-origin` grants the plugin's origin, never the embedding page's. The host checks
`event.source === iframe.contentWindow` and `event.origin === pluginOrigin` on every message.

> The current docs tester renders `srcdoc` with `allow-same-origin`, which runs the widget with the
> docs site's origin. Acceptable for a plugin previewing itself; **not** for third-party widget HTML
> (see Messages below).

### 5. Widget tool calls become callbacks/events

When the widget sends `tools/call`, the host:

1. fires `onToolCall({ name, args })` — the page may observe it, **answer it itself** (return a
   result), or reject it;
2. otherwise forwards it to the tool's REST route with the page's auth;
3. fires `onToolResult({ name, args, result | error })` and returns the result to the widget as a
   `CallToolResult` (`structuredContent` = JSON body; non-2xx → `isError` with the `{ error }` text,
   the same shape `connectWidget` already parses).

This makes `@visibility app` tools the natural "event" channel: a widget that lets the user pick
an employee calls `selectEmployee({ id })`, and the page reacts to it — with or without the server
doing anything. The other widget requests surface the same way: `onMessage` (`ui/message`),
`onModelContext` (`ui/update-model-context`), `onOpenLink` (default: `window.open`),
`onDisplayMode` (default: grant `inline` only), and `onSize` (default: set iframe height).

Tool id → REST route mapping (method, path template, path/query/body placement) comes from the
plugin itself — the same data `contents.json` already carries as `exposure.restUrl/restMethod`,
extended with parameter placement. `widgets.js` bakes it in; npm users fetch it once from
`/widgets/routes.json`.

### 6. Two ways to feed a widget

- **Call mode** — `tool` + `args`: the host calls the REST route, then delivers input + result.
  Changing `args` re-runs it. This is the vibe-coding case.
- **Result mode** — `tool` + `args` + `result`: the page already has the data (Messages' persisted
  tool part, the docs tester, a page that called the API itself); no call is made.

## API sketch

### Core (`@quartal/plugin-embed`, framework-agnostic, zero dependencies)

```ts
const plugin = connectPlugin({
  url: "https://salaxy-anon.vercel.app",
  getToken: async () => session.accessToken,   // optional; anonymous plugins omit it
});

// Plain REST call, typed by the caller (or via OpenAPI codegen).
const salary = await plugin.callTool<SalaryResult>("simpleSalary", { rows });

// Mount a widget into a container.
const widget = plugin.mountWidget(container, {
  tool: "simpleSalary",
  args: { rows },               // call mode
  // result: salary,            // result mode
  theme: "light",
  onToolCall: ({ name, args }) => { /* return a result to short-circuit */ },
  onToolResult: (e) => {}, onMessage: (m) => {}, onError: (msg) => {},
});
widget.update({ args: { rows: newRows } });
widget.setTheme("dark");
widget.dispose();
```

`createWidgetHost({ iframe, src | html, callTool, … })` is the lower-level protocol host under
`mountWidget` — transport-agnostic, used by the docs tester (MCP `callTool`) and Messages.

### Script tag + custom element (served by every plugin)

```html
<script type="module" src="https://salaxy-anon.vercel.app/widgets.js"></script>

<qrtl-widget tool="simpleSalary"></qrtl-widget>
<script>
  const el = document.querySelector("qrtl-widget");
  el.args = { rows: [{ type: "hourly", hours: 160, price: 18.5 }] };   // object args as a property
  el.addEventListener("toolcall", (e) => console.log(e.detail));
</script>
```

`/widgets.js` is the core bundle with the plugin's origin and route table baked in, served with
`Access-Control-Allow-Origin: *` (module scripts are fetched in CORS mode) and a short cache. Events:
`ready`, `result`, `error`, `toolcall`, `toolresult`, `message`, `modelcontext`. Auth:
`el.getToken = async () => …` or a `token` property.

Nice-to-have (phase 3): one element per widget tool, `<salaxy-anon-simple-salary>`, whose
primitive inputs are attributes coerced by the tool's JSON Schema
(`<hello-world-say-hello name="Olli">`). The generic element does all the work; this is only
naming plus attribute mapping.

### React (`@quartal/plugin-embed/react`, thin)

React 18 (still the Lovable default) passes only string attributes to custom elements and does not
wire custom events, so a small wrapper is worth it:

```tsx
<PluginWidget url="https://salaxy-anon.vercel.app" tool="simpleSalary" args={{ rows }}
  onToolCall={(c) => …} onError={setError} />
const { data, error, loading } = usePluginTool(url, "simpleSalary", { rows });
```

### Vue (`@quartal/plugin-embed/vue`)

Same component and a `usePluginTool` composable. Kept apart from `@quartal/plugin-vue`, so an embedding app does not pull in the widget-side
`@quartal/plugin/widget` (ext-apps `App`).

## Copy-paste instructions per plugin

- The docs SPA Widgets view gets, per widget: a **live preview** (call mode with an editable input
  form, reusing the tool tester's form; tool calls shown in the activity log) and an **Embed** tab
  with HTML / React / Vue snippets and a ready-made **prompt for a coding agent**, generated from the
  tool's input schema:

  > Add the "Simple salary" widget from https://salaxy-anon.vercel.app to this page. Load
  > `<script type="module" src="https://salaxy-anon.vercel.app/widgets.js">` and render
  > `<qrtl-widget tool="simpleSalary">`. Set `.args` to `{ rows: Row[] }` where Row is … . Listen
  > for `toolcall` events: `selectEmployee({ id })` fires when the user picks an employee.

- The same content, machine-readable, at `GET /widgets/<toolId>/embed.md` (and an index at
  `/widgets/embed.md`), so an agent can be pointed at one URL. A plugin could also ship it as an
  agent skill in `/skills/catalog.json`.

## Quartal Messages: same core, different adapter

Messages' chat (`@quartal/ui-messages` `QAiChat`) is a real MCP Apps host for **any** MCP server,
not only Quartal plugins. Its situation differs from embedding:

- MCP runs server-side in the worker (`@ai-sdk/mcp` in `AiStreamableAgent`), tool parts
  (`UIToolPart` input/output) are persisted → the chat renders in **result mode** from stored data.
- Widget HTML for a generic server exists only as an MCP resource (`resources/read` of the tool's
  `_meta.ui.resourceUri`), fetched by the worker with the user's token, so it is rendered from
  HTML, not a plugin URL.
- The widget's `tools/call` must go back through the Messages API (the server holds the MCP
  connection and token), `ui/message` appends a user message to the thread, and
  `ui/update-model-context` feeds the next turn.
- Third-party HTML needs real isolation: a **sandbox proxy on a separate origin** (as the MCP Apps
  spec recommends) with the resource's declared CSP, never `srcdoc` + `allow-same-origin` on the
  chat's origin.

So: **share the protocol host** (`createWidgetHost` with `html` + `callTool` + callbacks), **not**
the REST/embedding layer. Messages adds its own adapter (worker endpoints for resource HTML and
tool calls, the sandbox proxy, chat wiring). One host implementation means one set of conformance
tests, and a widget that works in the docs preview works in the chat.

Open in Messages: whether `@ai-sdk/mcp` keeps the tools' `_meta.ui` so the worker knows a tool has
a widget; otherwise the worker reads `tools/list` itself.

## Phases

1. **Core host** in `@quartal/plugin-embed` (`createWidgetHost`, `connectPlugin`,
   `mountWidget`) with conformance tests against ext-apps `App`; the docs tester and Widgets view
   switch to it, which drops `AppBridge` + zod from the docs bundle.
2. **Distribution**: `/widgets.js` + `/widgets/routes.json` + `<qrtl-widget>`;
   `@quartal/plugin-embed/react`; `@quartal/plugin-embed/vue`; Embed tab and `embed.md`; a sample page
   in `samples/` embedding a widget; website docs page "Embedding widgets".
3. **Per-tool custom elements**, then the Messages adapter in `quartal-messages`.

## Decided

- **Packaging**: one new package, `@quartal/plugin-embed` — the framework-agnostic core at the root,
  React bindings at `@quartal/plugin-embed/react`, Vue bindings at `@quartal/plugin-embed/vue`
  (React and Vue are optional peer dependencies).
- **Custom elements**: generic `<qrtl-widget>`; per-tool elements prefixed with the plugin name.
- **Auth**: bring your own bearer token (`getToken` / `token`); no login flow in the library.
