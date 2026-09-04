<script setup lang="ts">
import { useExtApps } from "@quartal/plugin-vue";

// Widget for the `sayHello` tool: the MCP host runs the tool and delivers the result
// (the greeting string) to this component over the MCP Apps bridge.
const { result, error } = useExtApps<string>({
  name: "SayHelloApp",
  version: "0.1.0",
});
</script>

<template>
  <div class="q-say-hello">
    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <h2 v-else-if="result">{{ result }}</h2>
    <div v-else>Waiting for the tool result…</div>
  </div>
</template>

<style scoped>
.q-say-hello {
  font-family: system-ui, sans-serif;
  padding: 1rem;
}
.error {
  color: #b3261e;
}
:global(html[data-theme="dark"]) .error {
  color: #ffb4ab;
}
</style>
