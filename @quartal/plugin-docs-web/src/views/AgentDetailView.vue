<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import type { AgentsCatalogResponse, PluginInfo } from "@quartal/plugin-core";
import { pluginClient } from "../lib/pluginClient.ts";

const props = defineProps<{ agentName: string; plugin: PluginInfo | null }>();

const catalog = ref<AgentsCatalogResponse | null>(null);
const agent = computed(() => catalog.value?.agents.find((a) => a.name === props.agentName));
const markdown = ref("");
const markdownError = ref("");
const loadError = ref("");

/** Bootstrap badge class per tool origin, so a glance says where each tool comes from. */
const TOOL_KIND_BG: Record<string, string> = {
  plugin: "text-bg-primary",
  environment: "text-bg-secondary",
  mcp: "text-bg-info",
  pattern: "text-bg-dark",
  unknown: "text-bg-warning",
};

/** Settings rendered as a definition list; only the ones the agent actually declares. */
const settings = computed(() => {
  const a = agent.value;
  if (!a) return [];
  return [
    { label: "Model", value: a.model ? (a.model.inherit ? "inherit" : a.model.id) : undefined },
    { label: "Permission mode", value: a.permissionMode },
    { label: "Effort", value: a.effort },
    { label: "Max turns", value: a.maxTurns?.toString() },
    { label: "Isolation", value: a.isolation },
    { label: "Color", value: a.color?.value },
    { label: "Source", value: a.source },
  ].filter((row): row is { label: string; value: string } => !!row.value);
});

onMounted(load);

watch(() => props.agentName, load);

async function load() {
  loadError.value = "";
  markdownError.value = "";
  markdown.value = "Loading…";
  try {
    catalog.value = await pluginClient.getAgentsCatalog();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
    return;
  }
  const found = agent.value;
  if (!found) {
    loadError.value = `Unknown agent: ${props.agentName}`;
    markdown.value = "";
    return;
  }
  try {
    markdown.value = await pluginClient.fetchFile(found.urls.markdown);
  } catch (e) {
    markdownError.value = e instanceof Error ? e.message : String(e);
    markdown.value = "";
  }
}
</script>

<template>
  <div>
    <p><RouterLink to="/agents">&laquo; All agents</RouterLink></p>

    <div v-if="loadError" class="alert alert-danger">{{ loadError }}</div>

    <template v-if="agent">
      <h1 class="d-flex align-items-center gap-2">
        <span
          v-if="agent.color"
          class="d-inline-block rounded-circle"
          :style="{ width: '1rem', height: '1rem', backgroundColor: agent.color.css ?? 'var(--bs-secondary)' }"
        />
        {{ agent.name }}
      </h1>
      <p class="lead">{{ agent.description }}</p>

      <div class="d-flex flex-wrap gap-2 mb-3">
        <a class="btn btn-sm btn-outline-primary" :href="agent.urls.markdown" target="_blank" rel="noopener">
          Open {{ agent.name }}.md
        </a>
        <a class="btn btn-sm btn-outline-primary" :href="agent.urls.json" target="_blank" rel="noopener">
          Open {{ agent.name }}.json
        </a>
      </div>

      <div class="row">
        <div class="col-md-4">
          <h2 class="h6">Settings</h2>
          <dl class="row small">
            <template v-for="row in settings" :key="row.label">
              <dt class="col-6 fw-semibold">{{ row.label }}</dt>
              <dd class="col-6 text-break">{{ row.value }}</dd>
            </template>
          </dl>

          <template v-if="agent.tools?.length">
            <h2 class="h6">Tools</h2>
            <ul class="list-unstyled small">
              <li v-for="tool in agent.tools" :key="tool.name" class="mb-1 text-break">
                <code>{{ tool.name }}</code>
                <span class="badge ms-1" :class="TOOL_KIND_BG[tool.kind]">{{ tool.kind }}</span>
              </li>
            </ul>
          </template>

          <template v-if="agent.disallowedTools?.length">
            <h2 class="h6">Denied tools</h2>
            <ul class="list-unstyled small">
              <li v-for="tool in agent.disallowedTools" :key="tool.name" class="mb-1 text-break">
                <code>{{ tool.name }}</code>
              </li>
            </ul>
          </template>

          <template v-if="agent.skills?.length">
            <h2 class="h6">Skills</h2>
            <ul class="list-unstyled small">
              <li v-for="skill in agent.skills" :key="skill" class="mb-1">
                <RouterLink :to="{ name: 'skill', params: { name: skill } }">{{ skill }}</RouterLink>
              </li>
            </ul>
          </template>

          <template v-if="agent.mcpServers?.length">
            <h2 class="h6">MCP servers</h2>
            <ul class="list-unstyled small">
              <li v-for="server in agent.mcpServers" :key="server.name" class="mb-2 text-break">
                <span class="fw-semibold">{{ server.name }}</span><br />
                <code>{{ server.url }}</code>
                <div v-if="server.description" class="text-muted">{{ server.description }}</div>
              </li>
            </ul>
          </template>
        </div>

        <div class="col-md-8">
          <h2 class="h6">{{ agent.source }}</h2>
          <div v-if="markdownError" class="alert alert-warning">{{ markdownError }}</div>
          <div v-else style="height: 640px;">
            <qrtl-editor type="monaco" read-only lang="markdown" :code="markdown"></qrtl-editor>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
