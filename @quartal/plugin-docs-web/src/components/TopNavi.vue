<script setup lang="ts">
import { computed } from "vue";
import type { PluginInfo } from "@quartal/plugin-core";

const props = defineProps<{
  /** The plugin info */
  plugin?: PluginInfo;
  /** The links to show in the navbar */
  links?: { name: string; url: string }[];
}>();


const logoUrl = computed(() => {
  const firstIcon = props.plugin?.style?.icons?.[0];
  if (!firstIcon) return "";
  return firstIcon.src;
});

</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-light bg-light border-bottom border-primary border-5 mb-4">
    <div class="container-fluid">
      <router-link class="navbar-brand" to="/">
        <img v-if="logoUrl" :src="logoUrl" class="navbar-logo me-2" style="height: 32px;">
        {{ plugin?.title ?? plugin?.name ?? "Unknown Plugin" }}
      </router-link>
      <div class="navbar-nav" v-if="links">
        <router-link v-for="link in links" :key="link.name" class="nav-link" :to="link.url">{{ link.name }}</router-link>
      </div>
    </div>
  </nav>
</template>