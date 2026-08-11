<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import type { PluginInfo } from "@quartal/plugin-core";

const props = defineProps<{
  plugin: PluginInfo;
  readmeHtml?: string;
  mcpUrl?: string;
  error?: string;
}>();

const summaryCards = computed(() => [
  { label: "Tools", count: props.plugin.tools.length, to: "/tools", bg: "text-bg-primary" },
  { label: "Skills", count: props.plugin.skills.length, to: "/skills", bg: "text-bg-secondary" },
  { label: "Widgets", count: props.plugin.widgets.length, to: "/widgets", bg: "text-bg-danger" },
  { label: "Resources", count: props.plugin.resources.length, to: "/resources", bg: "text-bg-info" },
  { label: "Prompts", count: props.plugin.prompts.length, to: "/prompts", bg: "text-bg-dark" },
]);
</script>

<template>
  <div class="q-plugin-about">
    <div class="row mb-4">
      <div class="col-3 d-flex align-items-center">
        <img :src="plugin.style.logo" alt="Logo" class="img-fluid" />
      </div>
      <div class="col-9">
        <h1 class="display-5 mb-0">{{ plugin.title }}</h1>
        <p class="mb-0"><code class="text-muted fs-4">{{ plugin.name }} ({{ plugin.version }})</code></p>
        <p class="lead">{{ plugin.description }}</p>
        <p v-if="mcpUrl" class="lead-x">
          To connect Claude or ChatGPT to the API, use the <b>MCP service</b> at<br />
          <code>{{ mcpUrl }}</code>
          <slot name="mcp-copy" />
        </p>
      </div>
    </div>
    <div v-if="error" class="alert alert-warning">{{ error }}</div>
    <div class="d-none d-md-flex flex-wrap">
      <template v-for="card in summaryCards" :key="card.label">
        <RouterLink
          v-if="card.count"
          :to="card.to"
          class="card me-2 col-2 text-decoration-none"
        >
          <div class="card-body text-center" :class="card.bg">
            <h5 class="card-title my-2 text-truncate">{{ card.label }}</h5>
            <h1 class="card-title m-1 fw-bold">{{ card.count }}</h1>
          </div>
        </RouterLink>
        <div v-else class="card me-2 col-2">
          <div class="card-body text-center" :class="card.bg">
            <h5 class="card-title my-2 text-truncate">{{ card.label }}</h5>
            <h1 class="card-title m-1 fw-bold">{{ card.count }}</h1>
          </div>
        </div>
      </template>
    </div>
    <hr />
    <div>
      <div v-if="!readmeHtml" class="text-start">
        <p class="text-muted">No README.md in this plugin.</p>
      </div>
      <div v-else class="text-start q-plugin-about__readme" v-html="readmeHtml" />
    </div>
  </div>
</template>
