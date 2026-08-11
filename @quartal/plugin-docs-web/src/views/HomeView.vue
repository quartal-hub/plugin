<script setup lang="ts">
import { marked } from "marked";
import { onMounted, ref } from "vue";
import type { PluginInfo } from "@quartal/plugin-core";
import { PluginAbout } from "@quartal/ui-plugin";
import { pluginClient } from "../lib/pluginClient.ts";
import CopyButton from "../components/CopyButton.vue";

defineProps<{ plugin: PluginInfo | null }>();

const readmeHtml = ref("");
const mcpUrl = ref("");
const error = ref("");

onMounted(async () => {
  mcpUrl.value = new URL("/mcp", window.location.origin).toString();
  try {
    const plugin = await pluginClient.getPlugin();
    if (plugin.hasReadme) {
      const md = await pluginClient.getReadme();
      readmeHtml.value = marked(md, { async: false }) as string;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <PluginAbout v-if="plugin" :plugin="plugin" :readme-html="readmeHtml" :mcp-url="mcpUrl" :error="error">
    <template #mcp-copy>
      <CopyButton :text="mcpUrl" />
    </template>
  </PluginAbout>
</template>
