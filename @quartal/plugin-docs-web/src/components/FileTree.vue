<script setup lang="ts">
import { computed } from "vue";
import type { SkillFileWithUrl } from "@quartal/plugin-core";
import { buildFileTree } from "../lib/fileTree.ts";
import FileTreeNode from "./FileTreeNode.vue";

const props = defineProps<{
  files: SkillFileWithUrl[];
  selectedPath?: string;
}>();

const emit = defineEmits<{ select: [file: SkillFileWithUrl] }>();
const root = computed(() => buildFileTree(props.files));
</script>

<template>
  <FileTreeNode :node="root" :selected-path="selectedPath" @select="emit('select', $event)" />
</template>
