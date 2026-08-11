<script setup lang="ts">
import type { PluginInfo } from "@quartal/plugin-core";

defineProps<{ plugin: PluginInfo | null }>();
</script>

<template>
  <div v-if="plugin">
    <h1>Prompts</h1>
    <p class="lead">MCP prompts exposed by this plugin.</p>
    <div v-if="!plugin.prompts.length" class="text-muted">None registered.</div>
    <ul v-else class="list-group">
      <li v-for="prompt in plugin.prompts" :key="prompt.name" class="list-group-item">
        <code>{{ prompt.name }}</code>
        <p v-if="prompt.description" class="mb-0 mt-1 text-muted small">{{ prompt.description }}</p>
      </li>
    </ul>
  </div>
</template>
