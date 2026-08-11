<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import type { CodeType, PluginInfo } from "@quartal/plugin-core";
import { PluginToolDetail } from "@quartal/ui-plugin";
import { pluginClient } from "../lib/pluginClient.ts";

const props = defineProps<{ plugin: PluginInfo | null; className: string; methodName: string }>();

const types = ref<CodeType[]>([]);
const error = ref("");

const tool = computed(() =>
  props.plugin?.tools.find((t) => t.className === props.className && t.name === props.methodName)
);

onMounted(async () => {
  try {
    types.value = await pluginClient.getTypes();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <div>
    <p>
      <RouterLink :to="{ name: 'toolGroup', params: { className } }">&laquo; {{ className }}</RouterLink>
    </p>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="!tool" class="alert alert-warning">Unknown tool: {{ className }}.{{ methodName }}</div>
    <PluginToolDetail v-else :tool="tool" :types="types" />
  </div>
</template>
