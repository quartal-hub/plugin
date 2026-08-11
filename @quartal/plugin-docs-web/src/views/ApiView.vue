<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { PluginInfo } from "@quartal/plugin-core";
import { pluginClient } from "../lib/pluginClient.ts";

defineProps<{ plugin: PluginInfo | null }>();
</script>

<template>
  <div>
    <h1>Rest API</h1>
    <p class="lead">OpenAPI documentation for this plugin.</p>

    <div class="mb-3">
      <RouterLink to="/api/swagger" class="btn btn-primary me-2">
        Swagger UI
      </RouterLink>
      <RouterLink to="/api/redoc" class="btn btn-secondary me-2">
        ReDoc
      </RouterLink>
      <a :href="pluginClient.url('/open-api.json')" class="btn btn-outline-secondary" target="_blank" rel="noopener">
        open-api.json
      </a>
    </div>

    <p v-if="plugin" class="text-muted mb-0">
      {{ plugin.tools.length }} REST endpoints across {{ plugin.toolGroups.length }} tool groups.
    </p>
  </div>
</template>
