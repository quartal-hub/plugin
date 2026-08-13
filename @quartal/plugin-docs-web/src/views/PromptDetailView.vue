<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import type { PluginInfo } from "@quartal/plugin-core";
import { PluginPromptDetail } from "@quartal/ui-plugin";

const props = defineProps<{
  plugin: PluginInfo | null;
  promptName: string;
}>();

const prompt = computed(() => props.plugin?.prompts.find((p) => p.name === props.promptName));
</script>

<template>
  <div v-if="plugin">
    <p class="mb-3">
      <RouterLink to="/prompts" class="text-decoration-none">&laquo; All prompts</RouterLink>
    </p>
    <PluginPromptDetail v-if="prompt" :prompt="prompt" />
    <div v-else class="alert alert-warning">
      Unknown prompt: <code>{{ promptName }}</code>
    </div>
  </div>
</template>
