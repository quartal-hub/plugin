<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { McpServerInfo, PluginInfo } from "@quartal/plugin-core";
import { pluginClient } from "../lib/pluginClient.ts";
import CopyButton from "../components/CopyButton.vue";

const props = defineProps<{ plugin: PluginInfo | null }>();

const server = ref<McpServerInfo | null>(null);
const error = ref("");
const mcpEndpoint = pluginClient.url("/mcp");

// Only tools exposed via MCP carry an `exposure.mcpName`.
const mcpTools = computed(() => (props.plugin?.tools ?? []).filter((t) => t.exposure.mcpName));
const widgets = computed(() => props.plugin?.widgets ?? []);
const resources = computed(() => props.plugin?.resources ?? []);
const prompts = computed(() => props.plugin?.prompts ?? []);

onMounted(async () => {
  try {
    server.value = await pluginClient.getMcpServer();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <div>
    <h1>MCP</h1>
    <p class="lead">Model Context Protocol catalog for this plugin.</p>
    <p>Endpoint: <code>{{ mcpEndpoint }}</code> <CopyButton :text="mcpEndpoint" /></p>
    <p>
      Overview: <a :href="pluginClient.url('/package.json')" target="_blank" rel="noopener">package.json</a>
    </p>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <section v-if="server" class="mb-4">
      <h2 class="h5">Server (initialize)</h2>
      <table class="table table-sm">
        <tbody>
          <tr><th>name</th><td><code>{{ server.name }}</code></td></tr>
          <tr v-if="server.title"><th>title</th><td>{{ server.title }}</td></tr>
          <tr><th>version</th><td>{{ server.version }}</td></tr>
          <tr v-if="server.description"><th>description</th><td>{{ server.description }}</td></tr>
          <tr v-if="server.websiteUrl"><th>website</th><td><a :href="server.websiteUrl" target="_blank" rel="noopener">{{ server.websiteUrl }}</a></td></tr>
        </tbody>
      </table>
    </section>

    <section class="mb-4">
      <h2 class="h5">Tools ({{ mcpTools.length }})</h2>
      <div v-for="t in mcpTools" :key="t.exposure.mcpName" class="border-start border-3 ps-2 mb-2">
        <code>{{ t.exposure.mcpName }}</code>
        <div v-if="t.description" class="text-muted small">{{ t.description }}</div>
      </div>
      <p v-if="!mcpTools.length" class="text-muted">None registered.</p>
    </section>

    <section class="mb-4">
      <h2 class="h5">Widgets ({{ widgets.length }})</h2>
      <div v-for="w in widgets" :key="w.name" class="mb-2">
        <code>{{ w.title ?? w.name }}</code>
        <div v-if="w.description" class="text-muted small">{{ w.description }}</div>
        <a v-if="w.toolId" :href="pluginClient.url('/widgets/' + encodeURIComponent(w.toolId))" target="_blank" rel="noopener">Preview</a>
      </div>
      <p v-if="!widgets.length" class="text-muted">None registered.</p>
    </section>

    <section class="mb-4">
      <h2 class="h5">Resources</h2>
      <p v-if="!resources.length" class="text-muted">None registered.</p>
      <ul v-else class="list-unstyled">
        <li v-for="r in resources" :key="r.name"><code>{{ r.name }}</code></li>
      </ul>
    </section>

    <section>
      <h2 class="h5">Prompts</h2>
      <p v-if="!prompts.length" class="text-muted">None registered.</p>
      <ul v-else class="list-unstyled">
        <li v-for="p in prompts" :key="p.name"><code>{{ p.name }}</code></li>
      </ul>
    </section>
  </div>
</template>
