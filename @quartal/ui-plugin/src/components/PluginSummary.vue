<script setup lang="ts">
import type { PluginInfo } from "@quartal/plugin-core";

defineProps<{
  plugin: PluginInfo;
}>();
</script>

<template>
  <header class="q-plugin-summary mb-4">
    <h1 class="q-plugin-summary__title h3 mb-1">{{ plugin.title }}</h1>
    <p class="text-muted small mb-2">{{ plugin.name }} · v{{ plugin.version }}</p>
    <p class="mb-2">{{ plugin.description }}</p>
    <p v-if="plugin.homepage" class="mb-0">
      <a :href="plugin.homepage" class="link-primary text-decoration-none" target="_blank" rel="noopener noreferrer">
        {{ plugin.homepage }}
      </a>
    </p>
  </header>
</template>
