<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PluginClientError, type PluginInfo, type Tool } from "@quartal/plugin-core";
import type { EmbedGuideTool } from "@quartal/plugin-embed/guide";
import { useDocsAuth } from "../lib/docsAuth.ts";
import { pluginClient } from "../lib/pluginClient.ts";
import CopyButton from "../components/CopyButton.vue";
import WidgetEmbedPanel from "../components/WidgetEmbedPanel.vue";

const props = defineProps<{ plugin: PluginInfo | null }>();

const auth = useDocsAuth();
const pluginUrl = new URL(pluginClient.url("/"), window.location.origin).origin;
const widgetsScriptUrl = `${pluginUrl}/widgets.js`;

const listedTools = ref<Tool[]>([]);
const toolsLoadError = ref<string | null>(null);
const route = useRoute();
const router = useRouter();
/** The widget shown, from `?tool=` so other pages can link to a widget's preview. */
const selected = computed(() => (typeof route.query.tool === "string" ? route.query.tool : null));
const select = (toolId: string) => router.replace({ query: { ...route.query, tool: toolId } });

const widgets = computed(() => props.plugin?.widgets ?? []);
const current = computed(() => widgets.value.find((w) => w.toolId === selected.value) ?? widgets.value[0]);
const schemaOf = (toolId: string) => listedTools.value.find((t) => t.name === toolId)?.inputSchema;
const appTools = computed<EmbedGuideTool[]>(() =>
  listedTools.value
    .filter((t) => {
      const visibility = t._meta?.ui?.visibility;
      return !!visibility?.includes("app") && !visibility.includes("model");
    })
    .map((t) => ({ id: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema })),
);

onMounted(async () => {
  try {
    listedTools.value = (await pluginClient.getMcpTools()).tools;
  } catch (e) {
    // A plugin with MCP turned off (`mcp: false`) has no tool list: the guides show the input
    // as an untyped object.
    if (e instanceof PluginClientError && e.status === 404) return;
    const cause = e instanceof Error ? e.message : String(e);
    toolsLoadError.value = `Could not load the tool list (${cause}).`;
  }
});
</script>

<template>
  <div v-if="plugin">
    <h1>Widgets</h1>
    <p class="lead">Tool UIs that run in MCP clients and embed in any web page.</p>
    <div v-if="!widgets.length" class="text-muted">No widgets registered.</div>
    <template v-else>
      <p>
        Load <code>{{ widgetsScriptUrl }}</code> <CopyButton :text="widgetsScriptUrl" /> as a module script and place
        <code>&lt;qrtl-widget tool="…"&gt;</code> elements on your page, or use the React and Vue components of
        <code>@quartal/plugin-embed</code>. Guides for coding agents:
        <a :href="`${pluginUrl}/widgets/embed.md`" target="_blank" rel="noopener">widgets/embed.md</a>.
      </p>

      <div class="row g-3">
        <div class="col-md-4 col-lg-3">
          <div class="list-group">
            <button
              v-for="widget in widgets"
              :key="widget.toolId"
              type="button"
              class="list-group-item list-group-item-action"
              :class="{ active: current?.toolId === widget.toolId }"
              @click="select(widget.toolId)"
            >
              <div class="fw-semibold">{{ widget.title }}</div>
              <code class="small" :class="{ 'text-white': current?.toolId === widget.toolId }">{{ widget.toolId }}</code>
            </button>
          </div>
        </div>
        <div v-if="current" class="col-md-8 col-lg-9">
          <div v-if="toolsLoadError" class="alert alert-warning py-2 small">{{ toolsLoadError }}</div>
          <h2 class="h5">{{ current.title }}</h2>
          <p>{{ current.description }}</p>
          <WidgetEmbedPanel
            :key="current.toolId"
            :widget="current"
            :plugin-url="pluginUrl"
            :plugin-title="plugin.title ?? plugin.name"
            :input-schema="schemaOf(current.toolId)"
            :app-tools="appTools"
            :requires-auth="auth.authAvailable.value"
            :token="auth.token.value"
          />
        </div>
      </div>
    </template>
  </div>
</template>
