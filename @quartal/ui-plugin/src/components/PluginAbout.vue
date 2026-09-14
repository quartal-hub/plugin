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

// MCP servers with display URLs: hosted (relative) URLs resolved against the main endpoint's
// origin, external servers shown at their original absolute URL.
const mcpServers = computed(() => {
  const servers = props.plugin.mcpServers ?? [];
  const origin = props.mcpUrl ? new URL(props.mcpUrl).origin : undefined;
  return servers.map((server) => ({
    ...server,
    displayUrl: server.external || !origin ? server.url : new URL(server.url, origin).toString(),
  }));
});
const multiServer = computed(() => mcpServers.value.length > 1);

// Resources come last: they are not in use yet, so they never lead the row.
const summaryCards = computed(() => [
  { label: "Tools", count: props.plugin.tools.length, to: "/tools", bg: "text-bg-primary" },
  { label: "Skills", count: props.plugin.skills.length, to: "/skills", bg: "text-bg-secondary" },
  { label: "Widgets", count: props.plugin.widgets.length, to: "/widgets", bg: "text-bg-danger" },
  { label: "Agents", count: props.plugin.agents?.length ?? 0, to: "/agents", bg: "text-bg-info" },
  { label: "Prompts", count: props.plugin.prompts.length, to: "/prompts", bg: "text-bg-dark" },
  { label: "Resources", count: props.plugin.resources.length, to: "/resources", bg: "text-bg-success" },
].filter((card) => card.count > 0));
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
        <div v-if="multiServer" class="lead-x">
          <p class="mb-1">To connect Claude or ChatGPT to the API, use the <b>MCP servers</b>:</p>
          <ul class="list-unstyled mb-0">
            <li v-for="server in mcpServers" :key="server.name" class="mb-1">
              <b>{{ server.name }}</b>
              <span v-if="server.external" class="badge text-bg-secondary ms-1">external</span>
              <span v-else-if="server.toolCount !== undefined" class="badge text-bg-light border ms-1">
                {{ server.toolCount }} {{ server.toolCount === 1 ? "tool" : "tools" }}
              </span>
              <br />
              <code>{{ server.displayUrl }}</code>
              <slot name="server-copy" :url="server.displayUrl" />
              <div v-if="server.description" class="text-muted small">{{ server.description }}</div>
            </li>
          </ul>
        </div>
        <p v-else-if="mcpUrl" class="lead-x">
          To connect Claude or ChatGPT to the API, use the <b>MCP service</b> at<br />
          <code>{{ mcpUrl }}</code>
          <slot name="mcp-copy" />
        </p>
      </div>
    </div>
    <div v-if="error" class="alert alert-warning">{{ error }}</div>
    <div class="d-none d-md-flex flex-wrap">
      <RouterLink
        v-for="card in summaryCards"
        :key="card.label"
        :to="card.to"
        class="card me-2 col-2 text-decoration-none"
      >
        <div class="card-body text-center" :class="card.bg">
          <h5 class="card-title my-2 text-truncate">{{ card.label }}</h5>
          <h1 class="card-title m-1 fw-bold">{{ card.count }}</h1>
        </div>
      </RouterLink>
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
