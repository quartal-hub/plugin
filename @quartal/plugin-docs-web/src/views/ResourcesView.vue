<script setup lang="ts">
import type { PluginInfo } from "@quartal/plugin-core";

defineProps<{ plugin: PluginInfo | null }>();
</script>

<template>
  <div v-if="plugin">
    <h1>Resources</h1>
    <p class="lead">MCP resources exposed by this plugin.</p>
    <div v-if="!plugin.resources.length" class="text-muted">None registered.</div>
    <ul v-else class="list-group">
      <li v-for="resource in plugin.resources" :key="resource.name" class="list-group-item">
        <code>{{ resource.name }}</code>
        <p v-if="resource.description" class="mb-0 mt-1 text-muted small">{{ resource.description }}</p>
      </li>
    </ul>
  </div>
</template>
