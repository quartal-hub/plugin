<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { PluginToolGroup } from "@quartal/plugin-core";

defineProps<{
  group: PluginToolGroup;
}>();
</script>

<template>
  <section class="q-plugin-tool-group">
    <header class="mb-4">
      <p class="text-muted small mb-1 font-monospace">{{ group.fileName }}.ts</p>
      <h1 class="h3 mb-2">{{ group.className }}</h1>
      <p class="text-muted mb-0">{{ group.tools.length }} tool{{ group.tools.length === 1 ? "" : "s" }}</p>
    </header>

    <div class="list-group">
      <RouterLink
        v-for="tool in group.tools"
        :key="tool.name"
        class="list-group-item list-group-item-action"
        :to="{ name: 'tool', params: { className: group.className, methodName: tool.name } }"
      >
        <div class="d-flex w-100 justify-content-between align-items-start gap-2">
          <div>
            <code class="font-monospace">{{ tool.name }}</code>
            <span v-if="tool.summary" class="ms-2">{{ tool.summary }}</span>
          </div>
          <div class="d-flex gap-1 flex-shrink-0">
            <span v-if="tool.hasWidget" class="badge text-bg-secondary rounded-pill">UI</span>
            <span v-if="tool.exposure.mcpName" class="badge text-bg-primary rounded-pill">MCP</span>
          </div>
        </div>
        <p v-if="tool.description" class="mb-0 mt-1 text-muted small">{{ tool.description }}</p>
      </RouterLink>
    </div>
  </section>
</template>
