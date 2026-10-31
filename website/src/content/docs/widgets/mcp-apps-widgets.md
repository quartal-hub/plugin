---
title: "MCP App Widgets"
description: "Add a real user interface to any tool — rendered inside the chat, in any UI framework."
section: creating
order: 2
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

Your plugin's own serving origin is whitelisted automatically. See [Configuration](/docs/reference/configuration) for details.

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

## Calling tools from a widget

A widget can call any of the plugin's tools — including `@visibility app` ones — and act on the result,
for example to select an item or load another page. In Vue, `useExtApps` returns a `callTool` function;
framework-agnostic code uses `callTool` on the bridge returned by `connectWidget`:

```ts
const { callTool } = useExtApps({ name: "InvoiceList" });
const page = await callTool<InvoiceRowsPage>("fetchInvoiceRows", { page: 2 });
```

`callTool` resolves with the parsed tool result and rejects with the tool's error message.

## Look and size

A widget that carries its own brand look turns the host theme off, so a dark host does not switch its form
controls and scrollbars to dark. The frame follows the content height by default; both are options of
`useExtApps` (and of `connectWidget`):

```ts
const { result, displayMode, availableDisplayModes, requestDisplayMode } = useExtApps({
  name: "InvoiceList",
  applyTheme: false, // keep the widget's own colors in a dark host
  autoResize: true,  // default: report the content size to the host
});
```

Hosts may also limit how tall an inline widget gets, or give it a fixed height (MCP Apps
`containerDimensions` in the host context), so a long list or table should scroll inside the widget
rather than rely on the frame growing; avoid `100vh` in inline mode.

The inline frame is only as tall as the widget's content, so a `position: fixed` dialog is clipped when the
content is short. Either render the dialog in the page flow, or ask the host for more room:

```ts
if (availableDisplayModes.value.includes("fullscreen")) await requestDisplayMode("fullscreen");
```

`requestDisplayMode` resolves with the mode the host actually set. Hosts differ in which modes they allow, so
check `availableDisplayModes` and keep the in-flow layout as the fallback.

## Testing widgets

The quickest way to see a widget is your plugin's own docs site. Run the plugin
(`pnpm dev`) and open the **Widgets** page at `http://localhost:4321/#/widgets`:

1. Pick the widget. The input box is filled with an example built from the tool's input type.
2. Edit the input and select **Run**: the tool runs over the REST API and the widget shows the
   result. Run again with other input, including input that makes the tool fail, to check the error
   view.
3. Switch on **Dark theme** to check the widget in a dark host.
4. Watch the activity log under the widget: every tool call the widget makes, its result, chat
   messages and model-context updates are listed there.

The preview is limited to 600 px in height, as chat hosts may limit inline widgets, so you also see
whether a tall widget scrolls inside itself. When the plugin needs a login, log in from the top
right first. The same page has the snippets for [embedding the widget](/docs/widgets/embedding-widgets)
in a web page.

For advanced cases, use [MCPJam](https://www.mcpjam.com/): point it at `http://localhost:4321/mcp`,
call the tool, and the widget renders in place inside a full MCP client. Use it to check what only a
real MCP host does — the widget loaded as a sandboxed `ui://` resource with its declared CSP,
fullscreen and picture-in-picture display modes, and a model calling the tool in a conversation.

## On web pages

The same widgets embed in any web page with one script tag and a `<qrtl-widget>` element, or with
React and Vue components — see [Embedding widgets](/docs/widgets/embedding-widgets).
