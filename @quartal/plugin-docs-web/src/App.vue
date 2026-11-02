<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import type { PluginInfo } from "@quartal/plugin-core";
import { PluginLeftNavi } from "@quartal/ui-plugin";
import { pluginClient } from "./lib/pluginClient.ts";
import TopNavi from "./components/TopNavi.vue";

const plugin = ref<PluginInfo | undefined>(undefined);
const loadError = ref("");
const route = useRoute();

/**
 * Below the `lg` breakpoint the left navigation is a Bootstrap offcanvas drawer (`offcanvas-lg`)
 * opened from the top bar's toggler; from `lg` up it is a static column and this flag has no effect.
 */
const naviOpen = ref(false);

watch(
  () => route.fullPath,
  () => {
    naviOpen.value = false;
  },
);

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") naviOpen.value = false;
}

onMounted(async () => {
  document.addEventListener("keydown", onKeydown);
  try {
    plugin.value = await pluginClient.getPlugin();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div class="plugin-docs-app">
    <TopNavi :plugin="plugin" :navi-open="naviOpen" @toggle-navi="naviOpen = !naviOpen" />
    <div class="container-fluid">
      <div class="row">
        <div class="col-lg-3 plugin-docs-app__navi">
          <div
            id="plugin-docs-navi"
            class="offcanvas-lg offcanvas-start"
            :class="{ show: naviOpen }"
            tabindex="-1"
            aria-labelledby="plugin-docs-navi-title"
          >
            <div class="offcanvas-header">
              <h5 id="plugin-docs-navi-title" class="offcanvas-title text-truncate">
                {{ plugin?.title ?? plugin?.name ?? "Navigation" }}
              </h5>
              <button type="button" class="btn-close" aria-label="Close" @click="naviOpen = false"></button>
            </div>
            <div class="offcanvas-body">
              <PluginLeftNavi v-if="plugin" :plugin="plugin" class="flex-grow-1" />
            </div>
          </div>
          <div
            v-if="naviOpen"
            class="offcanvas-backdrop fade show d-lg-none"
            @click="naviOpen = false"
          ></div>
        </div>
        <div class="col-lg-9">
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
  </div>
</template>
<style>
pre code {
  background-color: initial;
}

@media (min-width: 992px) {
  .plugin-docs-app__navi {
    max-width: 320px;
  }
}
</style>
