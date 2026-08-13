<script setup lang="ts">
import type { PluginInfo } from "@quartal/plugin-core";
import { RouterLink } from "vue-router";

defineProps<{ plugin: PluginInfo | null }>();
</script>

<template>
  <div v-if="plugin">
    <h1>Prompts</h1>
    <p class="lead">MCP prompts exposed by this plugin.</p>
    <div v-if="!plugin.prompts.length" class="text-muted">None registered.</div>
    <div v-else class="list-group">
      <RouterLink
        v-for="prompt in plugin.prompts"
        :key="prompt.name"
        :to="{ name: 'prompt', params: { promptName: prompt.name } }"
        class="list-group-item list-group-item-action"
      >
        <div class="d-flex justify-content-between align-items-start">
          <code>{{ prompt.name }}</code>
          <span v-if="prompt.arguments.length" class="badge bg-secondary rounded-pill">
            {{ prompt.arguments.length }} arg{{ prompt.arguments.length === 1 ? "" : "s" }}
          </span>
        </div>
        <div v-if="prompt.summary" class="fw-semibold mt-1">{{ prompt.summary }}</div>
        <p v-if="prompt.description" class="mb-0 mt-1 text-muted small">{{ prompt.description }}</p>
      </RouterLink>
    </div>
  </div>
</template>
