<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  buildArgsFromForm,
  buildExampleArgs,
  buildFormFields,
  connectMcpClient,
  type FormField,
  type FormModel,
  initFormModel,
  listMcpTools,
  type McpToolInfo,
  type McpToolResult,
  prettyJson,
} from "../helpers/mcpToolTester.ts";
import type { WidgetLogEntry, WidgetTheme } from "../helpers/mcpWidgetHost.ts";
import McpWidget from "./McpWidget.vue";

const props = withDefaults(
  defineProps<{
    /** MCP Streamable HTTP endpoint, e.g. `https://anon.salaxy.com/mcp`. */
    serverUrl: string;
    /** Heading shown above the tester. */
    title?: string;
    /** Tool id to preselect once tools are loaded. */
    initialTool?: string;
  }>(),
  { title: "MCP Tool Tester" },
);

type Status = "connecting" | "ready" | "error";

const status = ref<Status>("connecting");
const connectError = ref<string | null>(null);
const client = shallowRef<Client | null>(null);
const tools = ref<McpToolInfo[]>([]);
const selectedName = ref<string>("");

const inputMode = ref<"form" | "json">("form");
const fields = ref<FormField[]>([]);
// Editor state per field: string (text/number/date/enum), boolean (switch), or JSON text.
// Typed as `any` so each control's v-model binds without per-field casts.
const formModel = ref<Record<string, any>>({});
const jsonText = ref<string>("");
const jsonError = ref<string | null>(null);

const calling = ref(false);
const callError = ref<string | null>(null);
const result = shallowRef<McpToolResult | null>(null);
const executionId = ref(0);
const lastArgs = ref<Record<string, unknown>>({});

const theme = ref<WidgetTheme>("light");
const widgetLog = ref<Array<WidgetLogEntry & { id: number }>>([]);

const selectedTool = computed(() => tools.value.find((t) => t.name === selectedName.value) ?? null);
const resultText = computed(() => (result.value ? prettyJson(result.value) : ""));
const showWidget = computed(() => !!selectedTool.value?.resourceUri && !!result.value && !!client.value);

async function connect(): Promise<void> {
  status.value = "connecting";
  connectError.value = null;
  try {
    const c = await connectMcpClient(props.serverUrl);
    client.value = c;
    tools.value = await listMcpTools(c);
    const initial = props.initialTool && tools.value.some((t) => t.name === props.initialTool)
      ? props.initialTool
      : tools.value[0]?.name ?? "";
    selectedName.value = initial;
    status.value = "ready";
  } catch (e) {
    connectError.value = e instanceof Error ? e.message : String(e);
    status.value = "error";
  }
}

/** Rebuilds form fields + example arguments whenever the selected tool changes. */
function rebuildInputs(tool: McpToolInfo | null): void {
  result.value = null;
  callError.value = null;
  jsonError.value = null;
  widgetLog.value = [];
  if (!tool) {
    fields.value = [];
    formModel.value = {};
    jsonText.value = "";
    return;
  }
  const example = buildExampleArgs(tool.inputSchema);
  fields.value = buildFormFields(tool.inputSchema);
  formModel.value = initFormModel(fields.value, example);
  jsonText.value = prettyJson(example);
}

watch(selectedTool, rebuildInputs);

function syncFormToJson(): void {
  try {
    jsonText.value = prettyJson(buildArgsFromForm(fields.value, formModel.value));
    jsonError.value = null;
  } catch {
    // Leave the current JSON as-is; the form has an invalid sub-value the user can fix in JSON.
  }
}

function syncJsonToForm(): void {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText.value) as Record<string, unknown>;
  } catch {
    return; // Can't sync invalid JSON back into the form.
  }
  const next: FormModel = { ...formModel.value };
  for (const field of fields.value) {
    const value = parsed[field.name];
    if (field.control === "boolean") {
      next[field.name] = value === true;
    } else if (field.control === "json") {
      next[field.name] = value !== undefined ? prettyJson(value) : (next[field.name] ?? "");
    } else {
      next[field.name] = value !== undefined && value !== null ? String(value) : "";
    }
  }
  formModel.value = next;
}

function setMode(mode: "form" | "json"): void {
  if (mode === inputMode.value) return;
  if (mode === "json") syncFormToJson();
  else syncJsonToForm();
  inputMode.value = mode;
}

function validateJson(): void {
  try {
    JSON.parse(jsonText.value);
    jsonError.value = null;
  } catch (e) {
    jsonError.value = e instanceof Error ? e.message : String(e);
  }
}

function currentArgs(): Record<string, unknown> {
  if (inputMode.value === "json") {
    const parsed = JSON.parse(jsonText.value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Arguments must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  }
  return buildArgsFromForm(fields.value, formModel.value);
}

async function execute(): Promise<void> {
  if (!client.value || !selectedTool.value) return;
  callError.value = null;
  let args: Record<string, unknown>;
  try {
    args = currentArgs();
  } catch (e) {
    callError.value = e instanceof Error ? e.message : String(e);
    return;
  }
  calling.value = true;
  try {
    const res = await client.value.callTool({ name: selectedName.value, arguments: args });
    result.value = res as McpToolResult;
    lastArgs.value = args;
    widgetLog.value = [];
    executionId.value += 1;
  } catch (e) {
    callError.value = e instanceof Error ? e.message : String(e);
  } finally {
    calling.value = false;
  }
}

function pushLog(entry: WidgetLogEntry): void {
  widgetLog.value.push({ ...entry, id: widgetLog.value.length });
  if (widgetLog.value.length > 100) widgetLog.value.splice(0, widgetLog.value.length - 100);
}

function logText(data: unknown): string {
  if (typeof data === "string") return data;
  return prettyJson(data);
}

onMounted(connect);
</script>

<template>
  <section class="q-mcp-tool-tester">
    <header class="mb-4">
      <h1 class="h3 mb-1">{{ title }}</h1>
      <p class="text-muted small font-monospace mb-0">{{ serverUrl }}</p>
    </header>

    <p v-if="status === 'connecting'" class="text-muted">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Connecting to MCP server…
    </p>

    <div v-else-if="status === 'error'" class="alert alert-danger">
      <p class="mb-2">Could not connect to the MCP server.</p>
      <p class="small font-monospace mb-2">{{ connectError }}</p>
      <button class="btn btn-sm btn-outline-danger" type="button" @click="connect">Retry</button>
    </div>

    <div v-else class="row g-4">
      <!-- Tool list -->
      <div class="col-12 col-lg-4">
        <h2 class="h6 text-muted text-uppercase">Tools ({{ tools.length }})</h2>
        <div class="list-group">
          <button
            v-for="tool in tools"
            :key="tool.name"
            type="button"
            class="list-group-item list-group-item-action"
            :class="{ active: tool.name === selectedName }"
            @click="selectedName = tool.name"
          >
            <div class="d-flex w-100 justify-content-between align-items-start gap-2">
              <code class="font-monospace">{{ tool.name }}</code>
              <span v-if="tool.resourceUri" class="badge text-bg-secondary rounded-pill flex-shrink-0">UI</span>
            </div>
            <span v-if="tool.title" class="d-block small mt-1">{{ tool.title }}</span>
          </button>
        </div>
      </div>

      <!-- Tool detail + tester -->
      <div class="col-12 col-lg-8">
        <p v-if="!selectedTool" class="text-muted">Select a tool to test.</p>
        <div v-else>
          <header class="mb-3">
            <h2 class="h4 mb-1 font-monospace">{{ selectedTool.name }}</h2>
            <p v-if="selectedTool.description" class="text-muted mb-0">{{ selectedTool.description }}</p>
          </header>

          <!-- Input -->
          <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span class="fw-semibold">Input</span>
              <div class="btn-group btn-group-sm" role="group" aria-label="Input mode">
                <button
                  type="button"
                  class="btn"
                  :class="inputMode === 'form' ? 'btn-primary' : 'btn-outline-primary'"
                  @click="setMode('form')"
                >
                  Form
                </button>
                <button
                  type="button"
                  class="btn"
                  :class="inputMode === 'json' ? 'btn-primary' : 'btn-outline-primary'"
                  @click="setMode('json')"
                >
                  JSON
                </button>
              </div>
            </div>
            <div class="card-body">
              <!-- Generated form -->
              <div v-if="inputMode === 'form'">
                <p v-if="!fields.length" class="text-muted mb-0">This tool takes no parameters.</p>
                <div v-for="field in fields" :key="field.name" class="mb-3">
                  <label class="form-label mb-1" :for="`f-${field.name}`">
                    <code class="font-monospace">{{ field.name }}</code>
                    <span v-if="field.required" class="text-danger" aria-hidden="true">*</span>
                    <span class="badge text-bg-light border ms-2 fw-normal">{{ field.typeLabel }}</span>
                  </label>
                  <p v-if="field.description" class="form-text mt-0 mb-1">{{ field.description }}</p>

                  <select
                    v-if="field.control === 'enum'"
                    :id="`f-${field.name}`"
                    v-model="formModel[field.name]"
                    class="form-select"
                  >
                    <option v-if="!field.required" value="">(none)</option>
                    <option v-for="opt in field.enumValues" :key="opt" :value="opt">{{ opt }}</option>
                  </select>

                  <div v-else-if="field.control === 'boolean'" class="form-check form-switch">
                    <input
                      :id="`f-${field.name}`"
                      v-model="formModel[field.name]"
                      class="form-check-input"
                      type="checkbox"
                    />
                  </div>

                  <input
                    v-else-if="field.control === 'number' || field.control === 'integer'"
                    :id="`f-${field.name}`"
                    v-model="formModel[field.name]"
                    class="form-control"
                    type="number"
                    :step="field.control === 'integer' ? 1 : 'any'"
                  />

                  <input
                    v-else-if="field.control === 'date'"
                    :id="`f-${field.name}`"
                    v-model="formModel[field.name]"
                    class="form-control"
                    type="date"
                  />

                  <input
                    v-else-if="field.control === 'datetime'"
                    :id="`f-${field.name}`"
                    v-model="formModel[field.name]"
                    class="form-control"
                    type="datetime-local"
                  />

                  <textarea
                    v-else-if="field.control === 'json'"
                    :id="`f-${field.name}`"
                    v-model="formModel[field.name]"
                    class="form-control font-monospace"
                    rows="6"
                    spellcheck="false"
                  ></textarea>

                  <input
                    v-else
                    :id="`f-${field.name}`"
                    v-model="formModel[field.name]"
                    class="form-control"
                    type="text"
                  />
                </div>
              </div>

              <!-- Raw JSON -->
              <div v-else>
                <textarea
                  v-model="jsonText"
                  class="form-control font-monospace"
                  rows="12"
                  spellcheck="false"
                  aria-label="Tool arguments as JSON"
                  @input="validateJson"
                ></textarea>
                <div v-if="jsonError" class="text-danger small mt-1">Invalid JSON: {{ jsonError }}</div>
              </div>
            </div>
            <div class="card-footer d-flex align-items-center gap-3">
              <button
                type="button"
                class="btn btn-primary"
                :disabled="calling || (inputMode === 'json' && !!jsonError)"
                @click="execute"
              >
                <span v-if="calling" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {{ calling ? "Executing…" : "Execute" }}
              </button>
              <span v-if="callError" class="text-danger small">{{ callError }}</span>
            </div>
          </div>

          <!-- Result -->
          <div v-if="result" class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span class="fw-semibold">Result</span>
              <span v-if="result.isError" class="badge text-bg-danger">isError</span>
            </div>
            <div class="card-body p-0">
              <pre class="q-mcp-tool-tester__json mb-0 p-3"><code>{{ resultText }}</code></pre>
            </div>
          </div>

          <!-- Widget preview -->
          <div v-if="showWidget" class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span class="fw-semibold">Widget</span>
              <div class="btn-group btn-group-sm" role="group" aria-label="Widget theme">
                <button
                  type="button"
                  class="btn"
                  :class="theme === 'light' ? 'btn-secondary' : 'btn-outline-secondary'"
                  @click="theme = 'light'"
                >
                  Light
                </button>
                <button
                  type="button"
                  class="btn"
                  :class="theme === 'dark' ? 'btn-secondary' : 'btn-outline-secondary'"
                  @click="theme = 'dark'"
                >
                  Dark
                </button>
              </div>
            </div>
            <div class="card-body">
              <McpWidget
                :key="executionId"
                :client="client!"
                :resource-uri="selectedTool.resourceUri!"
                :tool-name="selectedTool.name"
                :tool-args="lastArgs"
                :tool-result="result!"
                :theme="theme"
                @log="pushLog"
                @error="(m) => pushLog({ level: 'error', source: 'widget', data: m })"
              />

              <details v-if="widgetLog.length" class="mt-3">
                <summary class="small text-muted">Widget activity ({{ widgetLog.length }})</summary>
                <ul class="q-mcp-tool-tester__log list-unstyled small font-monospace mt-2 mb-0">
                  <li v-for="entry in widgetLog" :key="entry.id" class="d-flex gap-2">
                    <span
                      class="badge flex-shrink-0"
                      :class="entry.level === 'error' ? 'text-bg-danger' : 'text-bg-light border'"
                    >{{ entry.source }}</span>
                    <span class="text-break">{{ logText(entry.data) }}</span>
                  </li>
                </ul>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
