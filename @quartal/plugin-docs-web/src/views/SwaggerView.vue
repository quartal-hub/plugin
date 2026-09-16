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
      persistAuthorization: true,
      // The top-bar login provides the bearer token; a manually authorized value still wins.
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
