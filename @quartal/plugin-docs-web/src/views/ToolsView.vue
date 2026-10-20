<script setup lang="ts">
import type { PluginInfo } from "@quartal/plugin-core";
import { PluginToolsIndex } from "@quartal/ui-plugin";

defineProps<{ plugin: PluginInfo | null }>();
</script>

<template>
  <PluginToolsIndex v-if="plugin" :plugin="plugin" />
</template>
