<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { PluginInfo } from "@quartal/plugin-core";

defineProps<{ plugin: PluginInfo | null }>();
</script>

<template>
  <div v-if="plugin">
    <h1>Tools</h1>
    <p class="lead">REST and MCP tools grouped by source class.</p>
    <div v-if="!plugin.toolGroups.length" class="text-muted">No tools exposed.</div>
    <div v-else class="list-group">
      <RouterLink
        v-for="group in plugin.toolGroups"
        :key="group.className"
        class="list-group-item list-group-item-action"
        :to="{ name: 'toolGroup', params: { className: group.className } }"
      >
        <div class="d-flex justify-content-between align-items-center">
          <span>{{ group.className }}</span>
          <span class="badge bg-primary rounded-pill">{{ group.tools.length }}</span>
        </div>
        <p class="mb-0 mt-1 text-muted small font-monospace">{{ group.fileName }}.ts</p>
      </RouterLink>
    </div>
  </div>
</template>
