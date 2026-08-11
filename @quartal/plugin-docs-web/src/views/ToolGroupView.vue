<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import type { PluginInfo } from "@quartal/plugin-core";
import { PluginToolGroup } from "@quartal/ui-plugin";

const props = defineProps<{ plugin: PluginInfo | null; className: string }>();

const group = computed(() => props.plugin?.toolGroups.find((g) => g.className === props.className));
</script>

<template>
  <div>
    <p><RouterLink to="/tools">&laquo; All tools</RouterLink></p>
    <div v-if="!group" class="alert alert-warning">Unknown tool group: {{ className }}</div>
    <PluginToolGroup v-else :group="group" />
  </div>
</template>
