# @quartal/ui-plugin

Vue components for visualizing Quartal plugin artifacts — tools, skills, and plugin metadata. Intended for agent-configuration UIs where users pick services, tools, and skills.

Standalone npm project (own lockfile). Will move to the quartal-salaxy monorepo later.

## Styling

Components use **Bootstrap** classes and Quartal CDN skins. Storybook loads `https://cdn.quartal.com/skins/default.css` automatically.

In consuming apps:

```ts
import { loadDefaultSkin } from "@quartal/ui-plugin";
import "@quartal/ui-plugin/src/styles/ui-plugin.css"; // dev / Storybook only

loadDefaultSkin();
```

See `.cursor/rules/ui-styling.mdc` and root `AGENTS.md` for white-label skin guidelines.

## MCP tool tester

`McpToolTester` connects to a plugin's MCP endpoint (Streamable HTTP), lists its tools, and lets you
call one and inspect the result — with a live preview of the tool's MCP Apps widget when it has one.

```vue
<script setup lang="ts">
import { McpToolTester } from "@quartal/ui-plugin";
</script>

<template>
  <McpToolTester server-url="https://anon.salaxy.com/mcp" />
</template>
```

- **Input** — a generated form (string / number / date / boolean / enum; objects and arrays fall back
  to a JSON text area) or a raw JSON editor, pre-filled from `@example` / `@default` in the schema.
- **Execute** — calls the tool over MCP and renders the result as JSON.
- **Widget** — `McpWidget` renders the tool's `ui://` resource in a sandboxed iframe and drives the full
  MCP Apps host side via the official [`@modelcontextprotocol/ext-apps`](https://www.npmjs.com/package/@modelcontextprotocol/ext-apps)
  `AppBridge`: the initialize handshake, tool input + result delivery, host-theme changes, size
  reporting, external links, chat messages, logging, and proxying the widget's own `tools/call`
  requests back to the MCP server (so a widget can call another MCP tool).

## Development

```bash
cd @quartal/ui-plugin
npm install
npm run storybook
```

## Build

```bash
npm run build
```

## npm publish

Run from `@quartal/plugin-core` first if publishing both packages:

```bash
cd ../plugin-core && npm run build
cd ../ui-plugin && npm run build
# npm publish when ready
```

During local development, `@quartal/plugin-core` is resolved via Vite alias to the Deno workspace source.
