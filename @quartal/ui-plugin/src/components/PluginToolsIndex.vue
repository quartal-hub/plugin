<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import type { McpToolAnnotations, PluginInfo, PluginToolEntry, RestMethod } from "@quartal/plugin-core";

const props = defineProps<{
  plugin: PluginInfo;
}>();

/** Bootstrap badge class per HTTP method, in the colours Swagger UI uses for them. */
const METHOD_BADGE: Record<RestMethod, string> = {
  GET: "text-bg-primary",
  POST: "text-bg-success",
  PUT: "text-bg-warning",
  DELETE: "text-bg-danger",
};

/** One Bootstrap icon per hint value, with the text shown on hover. */
interface HintIcon {
  icon: string;
  title: string;
}

/** The hints as icons: `readOnlyHint: true` → an eye, `destructiveHint: false` → a plus, … */
const HINT_ICONS: { key: keyof McpToolAnnotations; on: HintIcon; off: HintIcon }[] = [
  {
    key: "readOnlyHint",
    on: { icon: "bi-eye", title: "Read-only: the tool changes nothing" },
    off: { icon: "bi-pencil", title: "Writes: the tool changes data" },
  },
  {
    key: "destructiveHint",
    on: { icon: "bi-trash", title: "Destructive: may delete or overwrite data" },
    off: { icon: "bi-plus-circle", title: "Non-destructive: only adds data" },
  },
  {
    key: "idempotentHint",
    on: { icon: "bi-arrow-repeat", title: "Idempotent: repeating the call has no further effect" },
    off: { icon: "bi-shuffle", title: "Not idempotent: every call has an effect" },
  },
  {
    key: "openWorldHint",
    on: { icon: "bi-globe", title: "Open world: reaches outside the plugin's own data" },
    off: { icon: "bi-house-lock", title: "Closed world: stays within the plugin's own data" },
  },
];

const restCount = computed(() => props.plugin.tools.filter((t) => t.exposure.restUrl).length);
const mcpCount = computed(() => props.plugin.tools.filter((t) => t.exposure.mcpName).length);

function anchorId(className: string): string {
  return `tools-${className}`;
}

/** Scrolls to a group's section without touching the URL hash, which the hash router owns. */
function scrollToGroup(className: string) {
  document.getElementById(anchorId(className))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hints(tool: PluginToolEntry): HintIcon[] {
  const a = tool.annotations;
  if (!a) return [];
  return HINT_ICONS.flatMap(({ key, on, off }) => (a[key] === undefined ? [] : [a[key] ? on : off]));
}
</script>

<template>
  <section class="q-plugin-tools-index">
    <header class="mb-4">
      <h1>Tools</h1>
      <p class="lead mb-2">
        Every tool of the plugin with its REST operation and its MCP tool name, grouped by class.
      </p>
      <p class="text-muted mb-0">
        {{ plugin.tools.length }} tool{{ plugin.tools.length === 1 ? "" : "s" }} in
        {{ plugin.toolGroups.length }} group{{ plugin.toolGroups.length === 1 ? "" : "s" }}:
        {{ restCount }} REST operation{{ restCount === 1 ? "" : "s" }}, {{ mcpCount }} MCP tool{{ mcpCount === 1 ? "" : "s" }}.
      </p>
    </header>

    <p v-if="!plugin.toolGroups.length" class="text-muted">No tools exposed.</p>

    <nav v-else class="q-plugin-tools-index__toc d-flex flex-wrap gap-2 mb-4" aria-label="Tool groups">
      <a
        v-for="group in plugin.toolGroups"
        :key="group.className"
        class="btn btn-sm btn-outline-secondary"
        :href="`#${anchorId(group.className)}`"
        @click.prevent="scrollToGroup(group.className)"
      >
        {{ group.className }}
        <span class="badge text-bg-secondary rounded-pill ms-1">{{ group.tools.length }}</span>
      </a>
    </nav>

    <section
      v-for="group in plugin.toolGroups"
      :id="anchorId(group.className)"
      :key="group.className"
      class="q-plugin-tools-index__group mb-5"
    >
      <header class="border-bottom mb-2 pb-1">
        <h2 class="h4 mb-0">
          <RouterLink :to="{ name: 'toolGroup', params: { className: group.className } }" class="text-decoration-none">
            {{ group.className }}
          </RouterLink>
          <span class="text-muted small font-monospace ms-2">{{ group.fileName }}.ts</span>
        </h2>
        <p v-if="group.description" class="text-muted mb-0 mt-1">{{ group.description }}</p>
      </header>

      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Method</th>
              <th scope="col">REST</th>
              <th scope="col">MCP</th>
              <th scope="col">Hints</th>
              <th scope="col" class="text-center">Widget</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tool in group.tools" :key="tool.name">
              <td>
                <RouterLink
                  :to="{ name: 'tool', params: { className: group.className, methodName: tool.name } }"
                  class="font-monospace text-decoration-none"
                >{{ tool.name }}</RouterLink>
                <div v-if="tool.summary" class="text-muted small">{{ tool.summary }}</div>
              </td>
              <td class="text-nowrap">
                <template v-if="tool.exposure.restUrl && tool.exposure.restMethod">
                  <span class="badge q-plugin-tools-index__method" :class="METHOD_BADGE[tool.exposure.restMethod]">
                    {{ tool.exposure.restMethod }}
                  </span>
                  <code class="ms-1">{{ tool.exposure.restUrl }}</code>
                </template>
                <span v-else class="text-muted" title="No REST operation">-</span>
              </td>
              <td class="text-nowrap">
                <code v-if="tool.exposure.mcpName">{{ tool.exposure.mcpName }}</code>
                <span v-else class="text-muted" title="No MCP tool">-</span>
              </td>
              <td class="text-nowrap">
                <i
                  v-for="hint in hints(tool)"
                  :key="hint.icon"
                  class="bi q-plugin-tools-index__hint me-2"
                  :class="hint.icon"
                  :title="hint.title"
                  role="img"
                  :aria-label="hint.title"
                ></i>
              </td>
              <td class="text-center">
                <i
                  v-if="tool.hasWidget"
                  class="bi bi-check-lg text-success"
                  title="Has an MCP Apps widget"
                  role="img"
                  aria-label="Has an MCP Apps widget"
                ></i>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<style scoped>
.q-plugin-tools-index__method {
  min-width: 4.5em;
}

.q-plugin-tools-index__hint {
  font-size: 1.1em;
  color: var(--bs-secondary-color);
  cursor: help;
}
</style>
