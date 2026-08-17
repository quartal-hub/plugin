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
- `sendMessage(text)` — append a text message to the host's chat.
