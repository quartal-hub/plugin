<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import SwaggerUIBundle from "swagger-ui-dist/swagger-ui-es-bundle.js";
import "swagger-ui-dist/swagger-ui.css";
import { pluginClient } from "../lib/pluginClient.ts";

const container = ref<HTMLElement | null>(null);
const loadError = ref("");

onMounted(() => {
  if (!container.value) return;
  try {
    SwaggerUIBundle({
      url: pluginClient.url("/open-api.json"),
      domNode: container.value,
      deepLinking: false,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
      requestSnippetsEnabled: true,
      persistAuthorization: true,
    });
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
});

onBeforeUnmount(() => {
  if (container.value) container.value.replaceChildren();
});
</script>

<template>
  <div class="q-plugin-swagger-view">
    <div v-if="loadError" class="alert alert-danger">{{ loadError }}</div>
    <div ref="container" class="q-plugin-swagger-view__ui" />
  </div>
</template>
