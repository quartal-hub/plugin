<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { PluginWidgetEntry } from "@quartal/plugin-core";
import type { WidgetTheme, WidgetToolCall, WidgetToolResult } from "@quartal/plugin-embed";
import { buildEmbedGuide, type EmbedGuideTool, type JsonSchema } from "@quartal/plugin-embed/guide";
import { PluginWidget } from "@quartal/plugin-embed/vue";
import CopyButton from "./CopyButton.vue";

const props = defineProps<{
  /** The widget. */
  widget: PluginWidgetEntry;
  /** Plugin origin. */
  pluginUrl: string;
  /** Plugin display title. */
  pluginTitle: string;
  /** Input schema of the widget's tool, when the plugin publishes it over MCP. */
  inputSchema?: JsonSchema;
  /** Tools only the plugin's widgets call (the widget's events). */
  appTools: EmbedGuideTool[];
  /** The plugin's API needs a bearer token. */
  requiresAuth: boolean;
  /** The docs site's bearer token, when logged in. */
  token: string | null;
}>();

type Tab = "preview" | "html" | "react" | "vue" | "prompt";
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "preview", label: "Preview" },
  { id: "html", label: "HTML" },
  { id: "react", label: "React" },
  { id: "vue", label: "Vue" },
  { id: "prompt", label: "Prompt for a coding agent" },
];
const tab = ref<Tab>("preview");

const guide = computed(() =>
  buildEmbedGuide({
    pluginUrl: props.pluginUrl,
    pluginTitle: props.pluginTitle,
    toolId: props.widget.toolId,
    title: props.widget.title,
    description: props.widget.description,
    inputSchema: props.inputSchema,
    appTools: props.appTools,
    requiresAuth: props.requiresAuth,
  }),
);
const embedMdUrl = computed(() => `${props.pluginUrl}/widgets/${encodeURIComponent(props.widget.toolId)}/embed.md`);
const snippet = computed(() => (tab.value === "preview" ? "" : guide.value[tab.value]));

// Preview: an editable input, run on demand.
const argsText = ref("");
const argsError = ref<string | null>(null);
const args = ref<Record<string, unknown> | null>(null);
const theme = ref<WidgetTheme>("light");
const widgetError = ref<string | null>(null);
const activity = ref<Array<{ id: number; kind: string; text: string }>>([]);
let nextId = 0;

const exampleText = computed(() => JSON.stringify(guide.value.exampleArgs, null, 2));
watch(
  () => props.widget.toolId,
  () => {
    argsText.value = exampleText.value;
    args.value = null;
    activity.value = [];
    widgetError.value = null;
  },
  { immediate: true },
);
// The input schema can arrive after mount: refresh the example until the user edits it.
watch(exampleText, (next, previous) => {
  if (argsText.value === previous) argsText.value = next;
});

function run(): void {
  try {
    const parsed: unknown = JSON.parse(argsText.value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The input must be a JSON object.");
    argsError.value = null;
    widgetError.value = null;
    args.value = parsed as Record<string, unknown>;
  } catch (e) {
    argsError.value = e instanceof Error ? e.message : String(e);
  }
}

function log(kind: string, data: unknown): void {
  activity.value.unshift({ id: nextId++, kind, text: typeof data === "string" ? data : JSON.stringify(data) });
  if (activity.value.length > 50) activity.value.length = 50;
}

const onToolCall = (call: WidgetToolCall): undefined => {
  log("toolcall", { name: call.name, args: call.args });
  return undefined;
};
const onToolResult = (result: WidgetToolResult) => log("toolresult", { name: result.name, value: result.value, error: result.error });
const onError = (message: string) => {
  widgetError.value = message;
  log("error", message);
};
</script>

<template>
  <div class="q-widget-embed-panel">
    <ul class="nav nav-tabs mb-3">
      <li v-for="t in tabs" :key="t.id" class="nav-item">
        <button type="button" class="nav-link" :class="{ active: tab === t.id }" @click="tab = t.id">{{ t.label }}</button>
      </li>
    </ul>

    <div v-if="tab === 'preview'">
      <div v-if="requiresAuth && !token" class="alert alert-warning py-2 small">
        This plugin's API needs a login: log in (top right) to run the widget.
      </div>
      <label class="form-label small text-muted" :for="`args-${widget.toolId}`">Input (<code>args</code>)</label>
      <textarea
        :id="`args-${widget.toolId}`"
        v-model="argsText"
        class="form-control font-monospace small"
        rows="6"
        spellcheck="false"
      ></textarea>
      <div v-if="argsError" class="text-danger small mt-1">{{ argsError }}</div>
      <div class="d-flex align-items-center gap-2 mt-2 mb-3">
        <button type="button" class="btn btn-sm btn-primary" @click="run">Run</button>
        <div class="form-check form-switch mb-0 ms-2">
          <input
            :id="`theme-${widget.toolId}`"
            class="form-check-input"
            type="checkbox"
            :checked="theme === 'dark'"
            @change="theme = theme === 'dark' ? 'light' : 'dark'"
          />
          <label class="form-check-label small" :for="`theme-${widget.toolId}`">Dark theme</label>
        </div>
      </div>
      <PluginWidget
        v-if="args"
        class="border rounded"
        :url="pluginUrl"
        :tool="widget.toolId"
        :args="args"
        :theme="theme"
        :token="token"
        :on-tool-call="onToolCall"
        :on-tool-result="onToolResult"
        :on-error="onError"
        :on-message="(m) => log('message', m.content)"
        :on-model-context="(c) => log('modelcontext', c)"
      />
      <div v-if="widgetError" class="alert alert-danger mt-2 mb-0 py-2 px-3 small">{{ widgetError }}</div>
      <details v-if="activity.length" class="mt-3" open>
        <summary class="small text-muted">Widget activity ({{ activity.length }})</summary>
        <ul class="list-unstyled small font-monospace mt-2 mb-0">
          <li v-for="entry in activity" :key="entry.id" class="d-flex gap-2">
            <span class="badge text-bg-light">{{ entry.kind }}</span>
            <span class="text-break">{{ entry.text }}</span>
          </li>
        </ul>
      </details>
    </div>

    <div v-else>
      <p v-if="tab === 'prompt'" class="small text-muted">
        Paste this into Lovable, Claude Code, Cursor or another coding agent working on your page.
      </p>
      <p v-else-if="tab !== 'html'" class="small text-muted">
        <code>npm install @quartal/plugin-embed</code>
      </p>
      <div class="position-relative">
        <div class="position-absolute top-0 end-0"><CopyButton :text="snippet" /></div>
        <pre class="q-widget-embed-panel__code border rounded p-3 small mb-2"><code>{{ snippet }}</code></pre>
      </div>
      <p class="small mb-0">
        The full guide for people and agents: <a :href="embedMdUrl" target="_blank" rel="noopener">{{ embedMdUrl }}</a>
        <CopyButton :text="embedMdUrl" />
      </p>
    </div>
  </div>
</template>

<style scoped>
.q-widget-embed-panel__code {
  white-space: pre-wrap;
  background: var(--bs-tertiary-bg);
  max-height: 28rem;
  overflow: auto;
}
</style>
