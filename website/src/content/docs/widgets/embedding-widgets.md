---
title: "Embedding widgets"
description: "Show a plugin's widgets on any web page — plain HTML, React, Vue, or a page a coding agent builds."
section: creating
order: 2.5
---

The widgets you build for MCP clients also work on ordinary web pages. A page loads one script from
the plugin, places a `<qrtl-widget>` element, and gives it the tool's input: the element calls the
tool over the plugin's REST API and shows its widget with the result. Nothing in the widget changes —
the page simply becomes another [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview)
host, next to Claude and ChatGPT.

Every plugin documents this for each of its widgets: open the **Widgets** page of the plugin's docs
site for a live preview, copy-paste snippets and a ready-made prompt for a coding agent.

## Plain HTML

```html
<script type="module" src="https://your-plugin.example.com/widgets.js"></script>

<qrtl-widget tool="sayHello"></qrtl-widget>

<script type="module">
  const widget = document.querySelector('qrtl-widget[tool="sayHello"]');
  widget.args = { name: "Ada" };
  widget.addEventListener("toolcall", (e) => console.log(e.detail.name, e.detail.args));
</script>
```

- **`args`** is the tool's input. Set it as a property (objects are fine) or as a JSON `args`
  attribute. Setting it calls the tool again; until it is set, the widget waits. A tool that takes
  no input runs right away.
- **`result`** shows a result the page already has, without calling the tool.
- **`theme`** is `light` (default) or `dark`.
- **`max-height`** limits the height in pixels (the `maxHeight` property, and the `maxHeight` prop in
  React and Vue).
- **`plugin`** names the plugin's origin. It is only needed when the page loads widgets from several
  plugins and two of them have a widget for the same tool id.

The widget runs in an iframe on the plugin's own origin. The iframe follows the height of the
widget's content, up to `max-height` when you set one; the widget is told the limit and scrolls inside
itself beyond it. MCP clients such as Claude and ChatGPT may limit or fix the height of an inline
widget too, so design tall widgets to scroll inside themselves, or to ask for fullscreen.

### Events

The element fires these events (they do not bubble, so listen on the element):

| Event | `detail` |
|---|---|
| `ready` | — the widget is connected |
| `result` | the tool's JSON result |
| `error` | `{ message }` — the tool failed, or the plugin could not be reached |
| `toolcall` | `{ name, args, respondWith(value) }` — the widget calls a tool |
| `toolresult` | `{ name, args, result, value?, error? }` — that call finished |
| `message` | `{ role, content }` — the widget posts a chat message (`ui/message`) |
| `modelcontext` | `{ content?, structuredContent? }` — the widget updates the model context |

### Tool calls as events

When a widget calls a tool — to load more data, or because the user picked something — the page sees
it first. By default the element then runs the tool over REST with the page's auth and returns the
result to the widget. Call `respondWith` to answer the call yourself instead:

```js
widget.addEventListener("toolcall", (e) => {
  if (e.detail.name === "selectEmployee") {
    showEmployee(e.detail.args.id);
    e.detail.respondWith({ ok: true });   // the tool is not run
  }
});
```

This makes [`@visibility app`](/docs/tools/creating-tools) tools a natural event channel between a
widget and the page: the widget calls `selectEmployee({ id })`, and the page reacts to it, with or
without the server doing anything.

## Authentication

The library brings no login of its own: the page passes the bearer token it already has. Anonymous
plugins need nothing.

```js
widget.getToken = async () => session.accessToken;   // called before every request
// or: widget.token = accessToken;
```

`widgets.js` also exports the plugin connection, which sets the token for every element at once:

```js
import { plugin } from "https://your-plugin.example.com/widgets.js";
plugin.setAuth({ getToken: async () => session.accessToken });
```

## React and Vue

Install the package:

```bash
npm install @quartal/plugin-embed
```

React (`@quartal/plugin-embed/react`):

```tsx
import { PluginWidget, usePluginTool } from "@quartal/plugin-embed/react";

<PluginWidget
  url="https://your-plugin.example.com"
  tool="sayHello"
  args={{ name: "Ada" }}
  getToken={async () => session.accessToken}
  onToolCall={(call) => console.log(call.name, call.args)}
  onError={(message) => console.error(message)}
/>;

// The same tool without the widget:
const { data, error, loading } = usePluginTool("https://your-plugin.example.com", "sayHello", { name: "Ada" });
```

Vue (`@quartal/plugin-embed/vue`):

```vue
<script setup lang="ts">
import { PluginWidget, usePluginTool } from "@quartal/plugin-embed/vue";
</script>

<template>
  <PluginWidget
    url="https://your-plugin.example.com"
    tool="sayHello"
    :args="{ name: 'Ada' }"
    @tool-call="(call) => console.log(call.name, call.args)"
    @error="(message) => console.error(message)"
  />
</template>
```

`onToolCall` / `@tool-call` can return a value to answer the widget's call, like `respondWith`.

## Without a framework, from npm

`connectPlugin` calls tools over REST and mounts widgets into any element:

```ts
import { connectPlugin } from "@quartal/plugin-embed";

const plugin = connectPlugin({ url: "https://your-plugin.example.com", getToken: async () => token });
const greeting = await plugin.callTool("sayHello", { name: "Ada" });

const widget = plugin.mountWidget(document.getElementById("hello")!, {
  tool: "sayHello",
  args: { name: "Ada" },
  result: greeting,               // optional: show this instead of calling the tool
  onToolCall: (call) => { /* return a value to answer the call */ },
});
widget.update({ args: { name: "Grace" } });
widget.setTheme("dark");
widget.setMaxHeight(600);
await widget.dispose();
```

`callTool` rejects with a `PluginToolError` (with the HTTP `status`) when the plugin answers with an
error.

## Instructions for coding agents

Each widget has a Markdown guide at `/widgets/<toolId>/embed.md` — the snippets above filled in for
that widget, its input type, the tools it calls, and a prompt to paste into Lovable, Claude Code,
Cursor or another coding agent. `/widgets/embed.md` lists them all. Point an agent at one of these
URLs and it has everything it needs.

## How it works

- `/widgets.js` is a small module (about 5 KB gzipped) with the plugin's route table built in. It
  defines `<qrtl-widget>` and registers the plugin; the route table (`/widgets/routes.json`) maps each
  tool id to its REST route, so the element knows which method, path, query string and body to use.
- The element frames `/widgets/<toolId>` from the plugin and speaks the MCP Apps protocol with it over
  `postMessage`: it answers the widget's handshake, sends the input and the result, and handles the
  widget's requests — tool calls, links (opened in a new tab), chat messages, model context,
  display modes and size changes. A height limit reaches the widget as the MCP Apps
  `containerDimensions.maxHeight`. It accepts messages only from that iframe and the plugin's origin.
- The same host runs the widget preview in the plugin's docs site, so a widget that works there
  works on your page.
