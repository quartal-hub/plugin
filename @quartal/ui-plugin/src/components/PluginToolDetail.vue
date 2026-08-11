<script setup lang="ts">
import { computed } from "vue";
import type { CodeType, PluginToolEntry } from "@quartal/plugin-core";
import PluginTypeDoc from "./PluginTypeDoc.vue";

const props = defineProps<{
  tool: PluginToolEntry;
  types: CodeType[];
}>();

const typesByName = computed(() => new Map(props.types.map((t) => [t.name, t])));

const referencedTypes = computed(() => {
  const names = new Set<string>();
  for (const param of props.tool.parameters) {
    names.add(param.type);
  }
  names.add(props.tool.returns.type);
  return [...names]
    .map((name) => typesByName.value.get(name))
    .filter((t): t is CodeType => !!t);
});
</script>

<template>
  <article class="q-plugin-tool-detail">
    <header class="mb-4">
      <p class="text-muted small mb-1 font-monospace">{{ tool.className }}.{{ tool.name }}</p>
      <h1 class="h3 mb-2">{{ tool.summary || tool.name }}</h1>
      <p v-if="tool.description" class="lead">{{ tool.description }}</p>
      <div class="d-flex flex-wrap gap-2">
        <span v-if="tool.exposure.mcpName" class="badge text-bg-primary">MCP: {{ tool.exposure.mcpName }}</span>
        <span v-if="tool.exposure.restUrl" class="badge text-bg-secondary">
          {{ tool.exposure.restMethod?.toUpperCase() }} {{ tool.exposure.restUrl }}
        </span>
        <span v-if="tool.hasWidget" class="badge text-bg-danger">Widget</span>
      </div>
    </header>

    <section class="mb-4">
      <h2 class="h5">Parameters</h2>
      <table v-if="tool.parameters.length" class="table table-sm table-bordered">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="param in tool.parameters" :key="param.name">
            <td>
              <code class="font-monospace">{{ param.name }}</code>
              <span v-if="param.optional" class="text-muted">?</span>
              <span v-if="param.nullable" class="text-muted"> | null</span>
            </td>
            <td><code class="font-monospace">{{ param.type }}</code></td>
            <td>{{ param.description }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="text-muted mb-0">No parameters.</p>
    </section>

    <section class="mb-4">
      <h2 class="h5">Returns</h2>
      <p class="mb-1">
        <code class="font-monospace">{{ tool.returns.type }}</code>
        <span v-if="tool.returns.nullable" class="text-muted"> | null</span>
      </p>
      <p v-if="tool.returns.description" class="text-muted mb-0">{{ tool.returns.description }}</p>
    </section>

    <section v-if="referencedTypes.length">
      <h2 class="h5">Types</h2>
      <PluginTypeDoc v-for="typeDef in referencedTypes" :key="typeDef.name" :type-def="typeDef" />
    </section>
  </article>
</template>
