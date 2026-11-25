<script setup lang="ts">
import { computed } from "vue";
import type { SkillHttpFile } from "@quartal/plugin-core";
import { buildFileTree } from "../lib/fileTree.ts";
import FileTreeNode from "./FileTreeNode.vue";

const props = defineProps<{
  files: SkillHttpFile[];
  selectedPath?: string;
}>();

const emit = defineEmits<{ select: [file: SkillHttpFile] }>();
const root = computed(() => buildFileTree(props.files));
</script>

<template>
  <FileTreeNode :node="root" :selected-path="selectedPath" @select="emit('select', $event)" />
</template>
