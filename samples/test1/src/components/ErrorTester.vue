<script setup lang="ts">
import { useExtApps } from "@quartal/plugin-vue";

// Widget for the ErrorTester tools: renders the echoed value on success and the
// error message when the tool execution fails (isError: true from the MCP server).
const { result, error } = useExtApps<{ echoed?: string }>({
  name: "ErrorTesterApp",
  version: "0.1.0",
});
</script>

<template>
  <div class="q-error-tester">
    <h2>Error tester</h2>
    <div v-if="error" class="alert alert-danger" role="alert">
      <strong>Tool failed:</strong> {{ error }}
    </div>
    <div v-else-if="result" class="alert alert-success">
      <strong>Tool succeeded:</strong> {{ result.echoed || "(empty value)" }}
    </div>
    <div v-else class="alert alert-secondary">Waiting for the tool result…</div>
  </div>
</template>

<style scoped>
/* test1 loads no Bootstrap skin, so give the Bootstrap classes a minimal standalone fallback. */
.q-error-tester {
  font-family: system-ui, sans-serif;
  padding: 1rem;
}
.alert {
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
}
.alert-danger {
  background: #fdecea;
  color: #b3261e;
}
.alert-success {
  background: #e6f4ea;
  color: #1e7d34;
}
.alert-secondary {
  background: #eef1f4;
  color: #444;
}
:global(html[data-theme="dark"]) .alert-danger {
  background: #4a1f1c;
  color: #ffb4ab;
}
:global(html[data-theme="dark"]) .alert-success {
  background: #1d3a26;
  color: #9fd8ac;
}
:global(html[data-theme="dark"]) .alert-secondary {
  background: #2a2e33;
  color: #ccc;
}
</style>
