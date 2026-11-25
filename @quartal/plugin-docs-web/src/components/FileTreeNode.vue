<script setup lang="ts">
import FileTreeNode from "./FileTreeNode.vue";
import type { SkillHttpFile } from "@quartal/plugin-core";
import { sortedChildren, type TreeNode } from "../lib/fileTree.ts";

defineProps<{ node: TreeNode; selectedPath?: string }>();
const emit = defineEmits<{ select: [file: SkillHttpFile] }>();
</script>

<template>
  <ul v-if="node.children.size" class="list-unstyled ms-3 mb-0">
    <li v-for="child in sortedChildren(node)" :key="child.name" class="mb-1">
      <a
        v-if="child.file"
        href="#"
        class="text-decoration-none"
        :class="{ 'fw-bold': child.file.path === selectedPath }"
        @click.prevent="emit('select', child.file!)"
      >{{ child.name }}</a>
      <span v-else>{{ child.name }}</span>
      <FileTreeNode :node="child" :selected-path="selectedPath" @select="emit('select', $event)" />
    </li>
  </ul>
</template>
