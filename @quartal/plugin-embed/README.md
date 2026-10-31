# @quartal/plugin-embed

Embed [Quartal Plugin](https://plugin.quartal.com) widgets in any web page — plain HTML, React or Vue —
and call a plugin's tools over REST.

- **`createWidgetHost`** — the host side of the [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview)
  protocol for one widget iframe, with no dependencies: handshake, tool input and result, theme and
  display modes, and the widget's requests (tool calls, links, messages, model context, size).
- **`connectPlugin`** — a plugin connection: `callTool` over REST (the route table comes from the
  plugin's `/widgets/routes.json`) and `mountWidget` to show a tool's widget in an element.
- **`<qrtl-widget>`** (`@quartal/plugin-embed/element`) — the custom element every plugin also serves
  as `/widgets.js`.
- **React** (`@quartal/plugin-embed/react`) and **Vue** (`@quartal/plugin-embed/vue`) — a
  `PluginWidget` component and a `usePluginTool` hook / composable. React and Vue are optional peer
  dependencies.

## Script tag

```html
<script type="module" src="https://your-plugin.example.com/widgets.js"></script>
<qrtl-widget tool="sayHello"></qrtl-widget>
<script type="module">
  const widget = document.querySelector("qrtl-widget");
  widget.args = { name: "Ada" };
  widget.addEventListener("toolcall", (e) => console.log(e.detail.name, e.detail.args));
</script>
```

## npm

```ts
import { connectPlugin } from "@quartal/plugin-embed";

const plugin = connectPlugin({ url: "https://your-plugin.example.com", getToken: async () => token });
const greeting = await plugin.callTool("sayHello", { name: "Ada" });
plugin.mountWidget(document.getElementById("hello")!, { tool: "sayHello", args: { name: "Ada" } });
```

```tsx
import { PluginWidget } from "@quartal/plugin-embed/react";

<PluginWidget url="https://your-plugin.example.com" tool="sayHello" args={{ name: "Ada" }}
  onToolCall={(call) => console.log(call)} />;
```

When the widget calls a tool, `onToolCall` (or the element's `toolcall` event) sees it first and may
answer it; otherwise the tool runs over REST with the page's bearer token.

Full guide: [Embedding widgets](https://plugin.quartal.com/docs/widgets/embedding-widgets).
