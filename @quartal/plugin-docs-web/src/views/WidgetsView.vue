<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { PluginInfo } from "@quartal/plugin-core";
import type { EmbedGuideTool, JsonSchema } from "@quartal/plugin-embed/guide";
import { useDocsAuth } from "../lib/docsAuth.ts";
import { pluginClient } from "../lib/pluginClient.ts";
import CopyButton from "../components/CopyButton.vue";
import WidgetEmbedPanel from "../components/WidgetEmbedPanel.vue";

const props = defineProps<{ plugin: PluginInfo | null }>();

const auth = useDocsAuth();
const pluginUrl = new URL(pluginClient.url("/"), window.location.origin).origin;
const widgetsScriptUrl = `${pluginUrl}/widgets.js`;

/** The MCP `tools/list` entries: input schemas and visibility. */
interface ListedTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: JsonSchema;
  _meta?: { ui?: { visibility?: string[] } };
}
const listedTools = ref<ListedTool[]>([]);
const selected = ref<string | null>(null);

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
    const res = await fetch(pluginClient.url("/mcp/tools.json"));
    if (res.ok) listedTools.value = ((await res.json()) as { tools?: ListedTool[] }).tools ?? [];
  } catch {
    // Without MCP the guides show the input as an untyped object.
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
              @click="selected = widget.toolId"
            >
              <div class="fw-semibold">{{ widget.title }}</div>
              <code class="small" :class="{ 'text-white': current?.toolId === widget.toolId }">{{ widget.toolId }}</code>
            </button>
          </div>
        </div>
        <div v-if="current" class="col-md-8 col-lg-9">
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
