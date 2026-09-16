<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import SwaggerUIBundle from "swagger-ui-dist/swagger-ui-es-bundle.js";
import "swagger-ui-dist/swagger-ui.css";
import { pluginClient } from "../lib/pluginClient.ts";
import { useDocsAuth } from "../lib/docsAuth.ts";

const container = ref<HTMLElement | null>(null);
const loadError = ref("");
const auth = useDocsAuth();

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
      // The top-bar login handles auth and injects the token below, so Swagger's own auth UI
      // (Authorize button + per-operation locks) is hidden in the template — persisting it would
      // keep a stale, now-hidden authorization.
      requestInterceptor: (req: { headers: Record<string, string> }) => {
        if (auth.token.value && !req.headers.Authorization && !req.headers.authorization) {
          req.headers.Authorization = `Bearer ${auth.token.value}`;
        }
        return req;
      },
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

<style scoped>
/* Authentication is driven by the docs-site top-bar login (token injected via requestInterceptor),
   so Swagger's own auth controls are redundant and confusing: hide the Authorize bar and the
   per-operation lock buttons. */
.q-plugin-swagger-view :deep(.scheme-container),
.q-plugin-swagger-view :deep(.authorization__btn) {
  display: none;
}
</style>
