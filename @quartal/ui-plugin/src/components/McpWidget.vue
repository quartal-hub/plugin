<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { type McpToolResult, readWidgetHtml } from "../helpers/mcpToolTester.ts";
import { mountWidget, type WidgetHostHandle, type WidgetLogEntry, type WidgetTheme } from "../helpers/mcpWidgetHost.ts";

const props = withDefaults(
  defineProps<{
    /** Connected MCP client (used to read the widget resource and proxy the widget's tool calls). */
    client: Client;
    /** `ui://` resource URI of the widget to preview. */
    resourceUri: string;
    /** Tool id that produced {@link toolResult}. */
    toolName: string;
    /** Arguments the tool was called with. */
    toolArgs?: Record<string, unknown>;
    /** Tool result to hand to the widget. */
    toolResult: McpToolResult;
    /** Host theme reported to the widget. */
    theme?: WidgetTheme;
  }>(),
  { theme: "light", toolArgs: () => ({}) },
);

const emit = defineEmits<{
  (e: "ready"): void;
  (e: "log", entry: WidgetLogEntry): void;
  (e: "error", message: string): void;
}>();

const frame = ref<HTMLIFrameElement | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const frameHeight = ref(260);
let handle: WidgetHostHandle | null = null;

async function mount(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const html = await readWidgetHtml(props.client, props.resourceUri);
    const iframe = frame.value;
    if (!iframe) throw new Error("Widget iframe not available.");
    handle = await mountWidget({
      client: props.client,
      iframe,
      html,
      toolName: props.toolName,
      toolArgs: props.toolArgs,
      toolResult: props.toolResult,
      theme: props.theme,
      onInitialized: () => {
        emit("ready");
        emit("log", { level: "info", source: "ui/initialized", data: "widget ready" });
      },
      onSizeChange: ({ height }) => {
        if (typeof height === "number" && height > 0) frameHeight.value = Math.ceil(height);
        emit("log", { level: "debug", source: "ui/size-changed", data: { height } });
      },
      onLog: (entry) => emit("log", entry),
      onError: (message) => {
        loadError.value = message;
        emit("error", message);
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    loadError.value = message;
    emit("error", message);
  } finally {
    loading.value = false;
  }
}

onMounted(mount);

// Live theme changes don't require a reload — the host pushes a context change.
watch(
  () => props.theme,
  (theme) => handle?.setTheme(theme),
);

onBeforeUnmount(() => {
  void handle?.dispose();
  handle = null;
});
</script>

<template>
  <div class="q-mcp-widget">
    <div class="q-mcp-widget__frame-wrap position-relative">
      <div v-if="loading" class="q-mcp-widget__overlay d-flex align-items-center justify-content-center">
        <div class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true"></div>
        <span class="ms-2 text-muted small">Loading widget…</span>
      </div>
      <iframe
        ref="frame"
        class="q-mcp-widget__frame w-100 border rounded bg-white"
        :style="{ height: frameHeight + 'px' }"
        title="MCP widget preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      ></iframe>
    </div>
    <div v-if="loadError" class="alert alert-danger mt-2 mb-0 py-2 px-3 small" role="alert">
      Widget error: {{ loadError }}
    </div>
  </div>
</template>
