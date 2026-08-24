<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import type { AgentsCatalogResponse, PluginInfo } from "@quartal/plugin-core";
import { pluginClient } from "../lib/pluginClient.ts";

defineProps<{ plugin: PluginInfo | null }>();

const catalog = ref<AgentsCatalogResponse | null>(null);
const error = ref("");

onMounted(async () => {
  try {
    catalog.value = await pluginClient.getAgentsCatalog();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <div>
    <h1>Agents</h1>
    <p class="lead">
      Agents in this plugin
      (<a :href="pluginClient.url('/agents/catalog.json')" target="_blank" rel="noopener">catalog.json</a>).
    </p>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <div v-if="catalog && catalog.agents.length === 0" class="text-muted">
      No agents. Add <code>agents/&lt;name&gt;.md</code> files to the plugin.
    </div>

    <div v-for="agent in catalog?.agents ?? []" :key="agent.name" class="card mb-3">
      <div class="card-body">
        <h2 class="h5 d-flex align-items-center gap-2">
          <span
            v-if="agent.color"
            class="d-inline-block rounded-circle"
            :style="{ width: '0.75rem', height: '0.75rem', backgroundColor: agent.color.css ?? 'var(--bs-secondary)' }"
          />
          <RouterLink :to="{ name: 'agent', params: { agentName: agent.name } }">{{ agent.name }}</RouterLink>
        </h2>
        <p>{{ agent.description }}</p>
        <div class="d-flex flex-wrap gap-2 mb-2 small">
          <span v-if="agent.model" class="badge text-bg-light">
            {{ agent.model.inherit ? "model: inherit" : agent.model.id }}
          </span>
          <span v-if="agent.tools?.length" class="badge text-bg-light">
            {{ agent.tools.length }} tool{{ agent.tools.length === 1 ? "" : "s" }}
          </span>
          <span v-for="skill in agent.skills ?? []" :key="skill" class="badge text-bg-light">
            skill: {{ skill }}
          </span>
          <span v-for="server in agent.mcpServers ?? []" :key="server.name" class="badge text-bg-light">
            mcp: {{ server.name }}
          </span>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <RouterLink class="btn btn-sm btn-primary" :to="{ name: 'agent', params: { agentName: agent.name } }">
            View agent
          </RouterLink>
          <a class="btn btn-sm btn-outline-primary" :href="agent.urls.markdown" target="_blank" rel="noopener">
            {{ agent.name }}.md
          </a>
          <a class="btn btn-sm btn-outline-primary" :href="agent.urls.json" target="_blank" rel="noopener">
            {{ agent.name }}.json
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
