# @quartal/plugin-vue

Vue bindings for Quartal Plugin widgets: composables over the framework-agnostic
`@quartal/plugin/widget` bridge.

Widgets can be written in any framework — the MCP Apps bridge logic (tool results,
errors, theming) lives in `connectWidget` from `@quartal/plugin/widget`. This package
wraps it in Vue idioms (reactive refs), and nothing more.

## Usage

```vue
<script setup lang="ts">
import { useExtApps } from "@quartal/plugin-vue";

const { result, error, theme, sendMessage } = useExtApps<MyPayload>({
  name: "MyWidget",
  version: "1.0.0",
  // Optional: applyTheme: false keeps a brand-fixed look in a dark host; autoResize: false stops size reporting.
});
</script>

<template>
  <div v-if="error" class="alert alert-warning">{{ error }}</div>
  <pre v-else-if="result">{{ result }}</pre>
  <div v-else>Waiting for the tool result…</div>
</template>
```

- `result` — the latest tool result (`structuredContent`-first, text-content fallback).
- `error` — tool execution errors (`isError: true`), cancellations, and parse failures.
- `theme` — the host theme (`"light"` / `"dark"`), also applied to `<html data-theme>`.
- `displayMode`, `availableDisplayModes` — how the host currently lays the widget out (`inline`, `fullscreen`, `pip`) and which modes it allows.
- `requestDisplayMode(mode)` — ask the host for another display mode (for example `fullscreen` for a dialog); resolves with the mode the host set.
- `sendMessage(text)` — append a text message to the host's chat.
- `callTool(name, args)` — call one of the plugin's own tools (including `@visibility app` tools) and get its parsed result; rejects with the tool's error message. Waits for the host handshake.
