<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { loadRedoc } from "../lib/loadRedoc.ts";
import { pluginClient } from "../lib/pluginClient.ts";
import { redocScrollYOffset } from "../lib/redocScrollYOffset.ts";

const container = ref<HTMLElement | null>(null);
const loadError = ref("");

function bootstrapColor(cssVar: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return value || fallback;
}

onMounted(async () => {
  if (!container.value) return;
  try {
    const Redoc = await loadRedoc();
    const primary = bootstrapColor("--bs-primary", "#0d6efd");

    Redoc.init(
      pluginClient.url("/open-api.json"),
      {
        expandResponses: "200",
        scrollYOffset: redocScrollYOffset,
        theme: {
          logo: {
            gutter: "32px",
          },
          colors: {
            primary: {
              main: primary,
            },
          },
          rightPanel: {
            backgroundColor: primary,
          },
          typography: {
            fontFamily: bootstrapColor("--bs-body-font-family", "system-ui, sans-serif"),
            headings: {
              fontFamily: bootstrapColor("--bs-body-font-family", "system-ui, sans-serif"),
              fontWeight: "700",
            },
          },
        },
      },
      container.value,
    );
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
});

onBeforeUnmount(() => {
  if (container.value) container.value.replaceChildren();
});
</script>

<template>
  <div class="q-plugin-redoc-view">
    <div v-if="loadError" class="alert alert-danger">{{ loadError }}</div>
    <div ref="container" class="q-plugin-redoc-view__ui" />
  </div>
</template>
