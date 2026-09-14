---
title: "Add MCP server"
description: "The built-in MCP server every plugin gets automatically, hosting several named servers, and declaring external MCP servers."
section: creating
order: 6
---

## The built-in MCP server

You never have to "add" the first MCP server: **as soon as the plugin has a tool or a prompt, it
is an MCP server**. Add a class to `src/tools/` (or `src/prompts/`) and export it from the `mod.ts`
barrel — the plugin then serves a complete MCP server with zero configuration:

- **Endpoint**: `/mcp` on the plugin's origin, speaking streamable HTTP — point Claude, ChatGPT,
  MCPJam or any MCP client at `http://localhost:4321/mcp` in dev.
- **Name**: the last segment of the plugin name (`my-plugin` for `@my-org/my-plugin`). Override it
  with `mcp.name` in `qrtl.config.ts`.
- **Capabilities**: `tools` always; `prompts` when the plugin has [prompts](/docs/more/prompts/);
  `resources` when it has [widgets](/docs/widgets/mcp-apps-widgets/) (each widget is served as a
  `ui://widgets/<toolId>.html` resource).
- **Declared everywhere**: the server is emitted into the generated
  [`mcp.json`](/docs/reference/http-endpoints/) (and Claude's `.mcp.json` inside `/plugin.zip`),
  listed in the plugin overview, and shown on the plugin's own docs site with a live tool tester.
- **REST mirrors**: `GET /mcp/tools.json`, `/mcp/prompts.json` and `/mcp/resources.json` return
  the exact `tools/list` / `prompts/list` / `resources/list` results as plain GETs — handy for
  debugging and for agents that just want to read the catalog.

Set `mcp: false` in `qrtl.config.ts` to turn the MCP server off (the REST API keeps working).

## Host several named servers

One plugin can host **multiple MCP servers**, each exposing a subset of the tool classes. This
keeps a client's tool list focused: a client interested only in reporting tools does not need to
see the admin tools. Define a `mcp.servers` map in `qrtl.config.ts`:

```ts
import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "My Plugin",
  mcp: {
    servers: {
      main: {
        tools: ["Invoices", "Customers"],
        description: "Day-to-day invoicing tools.",
      },
      admin: {
        tools: ["UserAdmin"],
        description: "Administrative tools.",
      },
    },
  },
});
```

The rules:

- Each server is mounted at **`/mcp/<name>`**; names must match `[a-z0-9_-]+`.
- The server named **`main`** (or the first entry, when none is named `main`) is the main server
  and is *also* served at `/mcp`.
- `tools` lists **tool class names** from `src/tools/`. Omitting `tools` on a hosted server means
  *all* tool classes.
- **Prompts** are served on the main server; each **widget** is served by the server that owns
  its tool.
- Every server gets its own REST mirror, e.g. `GET /mcp/admin/tools.json`.

## Add an external MCP server

A plugin can also declare an MCP server that **already exists elsewhere** — an upstream service,
a server with special auth, or an old server you are migrating from. Use `external` instead of
`tools`:

```ts
export default defineQrtlConfig({
  mcp: {
    servers: {
      main: { description: "This plugin's own tools." },
      "astro-docs": {
        external: { url: "https://mcp.docs.astro.build/mcp" },
        description: "Astro documentation search.",
      },
    },
  },
});
```

An external server is **declaration-only**: the plugin does not host or proxy it. The entry is
emitted into the generated `mcp.json` (and `.mcp.json`) next to the hosted servers, so a client
that installs the plugin connects to the original URL directly. `external.headers` adds HTTP
headers clients should send (e.g. an API-key header) — but note that **`mcp.json` is public**:
never put a secret value in `headers`.

`external` and `tools` are mutually exclusive; everything else about naming works as above (an
external server named `main` does not take over `/mcp`, though — only hosted servers mount there).

## A complete example

The [test1 sample](https://github.com/quartal-hub/plugin/blob/main/samples/test1/qrtl.config.ts)
uses all three kinds of entries: a `main` server with the general demo tools, a hosted `types`
server exposing only the `TypesTester` class, and the external `astro-docs` server.

## Where the servers show up

- **`GET /mcp.json`** — the standard MCP configuration document: every server as a
  `streamable-http` entry; hosted servers on the plugin's origin, external servers at their
  original URL.
- **The plugin's docs site** — the front page lists every server with its endpoint URL, and the
  *MCP Servers* page shows the endpoints, tool counts and descriptions.
- **`GET /com.quartal.plugin/contents.json`** — the `mcpServers` array of the plugin overview.
- **`GET /plugin.zip`** — the installable Agent Plugin, carrying both MCP config variants.

See the [HTTP endpoints reference](/docs/reference/http-endpoints/) for the full endpoint list and
the [configuration reference](/docs/reference/configuration/) for every `mcp` option.
