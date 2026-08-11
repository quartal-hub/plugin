<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { PluginInfo } from "@quartal/plugin-core";
import { PluginLeftNavi } from "@quartal/ui-plugin";
import { pluginClient } from "./lib/pluginClient.ts";
import TopNavi from "./components/TopNavi.vue";

const plugin = ref<PluginInfo | undefined>(undefined);
const loadError = ref("");

onMounted(async () => {
  try {
    plugin.value = await pluginClient.getPlugin();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <div class="plugin-docs-app">
    <TopNavi :plugin="plugin" />
    <div class="row">
      <div class="col-3" style="max-width: 320px;">
        <PluginLeftNavi v-if="plugin" :plugin="plugin" />
      </div>
      <div class="col-9">
        <main class="container pb-5">
          <div v-if="loadError" class="alert alert-danger" role="alert">
            Cannot reach hub API at <code>/package.json</code>: {{ loadError }}.
            Start a plugin with <code>pnpm dev</code> (port 4321), then run the docs UI dev server.
          </div>
          <router-view :plugin="plugin" />
        </main>
      </div>
    </div>
  </div>
</template>
<style>
pre code {
  background-color: initial;
}
</style>
