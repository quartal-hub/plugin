---
title: "MCP Apps widgets"
description: "Add a real user interface to any tool — rendered inside the chat, in any UI framework."
section: widgets
order: 1
---

A **widget** gives a tool a real user interface, rendered inside the chat by hosts that support
the [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) standard (Anthropic
Claude, OpenAI ChatGPT, M365 Copilot, Quartal Hub, …). Clients without widget support simply fall
back to the model rendering the result as text.

Why widgets:

- The tool result renders **exactly as you specify** — not something the model improvises.
- **Saves tokens**: none are spent on rendering UI.
- Renders many times **faster** than streaming UI text from the model.

## Create a widget

A widget is just a page: create `src/pages/widgets/<toolId>.astro`, where `<toolId>` is the name
of the tool the widget belongs to. Because your plugin is an Astro project, the page can use
[any UI framework](https://docs.astro.build/en/guides/framework-components/) — Vue, React,
Svelte, plain JavaScript…

```astro
---
// file: src/pages/widgets/sayHello.astro
import WidgetLayout from "../../layouts/WidgetLayout.astro";
import Widget from "../../components/HelloWidget.vue";
---
<WidgetLayout title="Say hello">
  <Widget client:only="vue" />
</WidgetLayout>
```

For Vue, the `@quartal/plugin-vue` package provides composables (over the framework-agnostic
`@quartal/plugin/widget` helpers) for talking to the host: reading the tool result, calling tools,
and sending follow-up messages. See the
[plugin template](https://github.com/quartal-hub/plugin-template) for a complete example.

## How the widget is advertised

Everything is wired automatically:

- The widget is listed as an MCP **resource** (`ui://…`) with the `text/html;profile=mcp-app`
  MIME type.
- The tool's `tools/list` entry gets `_meta.ui.resourceUri` pointing at that resource, so hosts
  know to render your UI for the tool's results.
- When the host reads the resource, the live page is served with asset URLs rewritten so it works
  inside the host's sandboxed iframe.

## Content-Security-Policy

Widgets run in a sandboxed iframe; hosts enforce the CSP you declare. Configure it in
`qrtl.config.ts` — shared for all widgets and/or per widget:

```ts
import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  widgets: {
    // CSP applied to every widget.
    csp: { connectDomains: ["https://api.example.com"] },
    // Per-widget overrides, keyed by tool id.
    entries: {
      sayHello: { name: "Hello", csp: { resourceDomains: ["https://cdn.example.com"] } },
    },
  },
});
```

Your plugin's own serving origin is whitelisted automatically.

## Widget-only helper tools

A widget often needs finer-grained data than the tool that opened it — paging, sorting, drill-down.
Create a normal tool for that and mark it `@visibility app`, so your widget can call it but the AI
model never sees it:

```ts
/**
 * Returns one page of rows for the invoice-list widget.
 * @visibility app
 */
async fetchInvoiceRows(input: FetchInvoiceRowsInput): Promise<InvoiceRowsPage> { … }
```

See [`@visibility`](/docs/tools/creating-tools#visibility) in the tool-authoring guide.

## Testing widgets

We recommend [MCPJam](https://www.mcpjam.com/) for local widget testing — point it at
`http://localhost:4321/mcp`, call the tool, and the widget renders in place. Your plugin's own
docs site at `/` also includes a widget tester.
