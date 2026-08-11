<script setup lang="ts">
import type { PluginInfo } from "@quartal/plugin-core";
import { pluginClient } from "../lib/pluginClient.ts";

defineProps<{ plugin: PluginInfo | null }>();
</script>

<template>
  <div v-if="plugin">
    <h1>Widgets</h1>
    <p class="lead">MCP Apps widget UIs registered for tools.</p>
    <div v-if="!plugin.widgets.length" class="text-muted">No widgets registered.</div>
    <div v-for="widget in plugin.widgets" :key="widget.toolId" class="card mb-3">
      <div class="card-body">
        <h2 class="h5"><code>{{ widget.title }}</code></h2>
        <p>{{ widget.description }}</p>
        <p class="small text-muted mb-2">Tool: <code>{{ widget.toolId }}</code></p>
        <a
          :href="pluginClient.url('/widgets/' + encodeURIComponent(widget.toolId))"
          class="btn btn-sm btn-outline-primary"
          target="_blank"
          rel="noopener"
        >
          Preview
        </a>
      </div>
    </div>
  </div>
</template>
