<script setup lang="ts">
import type { CodeType } from "@quartal/plugin-core";
import { typeLabel } from "../helpers/typeLabel.ts";

defineProps<{
  typeDef: CodeType;
  /** When true, show only the type name (for inline references). */
  compact?: boolean;
}>();
</script>

<template>
  <article class="q-plugin-type-doc card mb-3">
    <div class="card-body">
      <h3 class="h6 mb-1"><code class="font-monospace">{{ typeDef.name }}</code></h3>
      <p v-if="typeDef.description && !compact" class="text-muted small mb-2">{{ typeDef.description }}</p>
      <p v-if="typeDef.extends.length" class="small mb-2">
        Extends:
        <code v-for="(name, i) in typeDef.extends" :key="name" class="font-monospace">
          {{ name }}<span v-if="i < typeDef.extends.length - 1">, </span>
        </code>
      </p>
      <p v-if="typeDef.enum?.length" class="small mb-2">
        Values:
        <code v-for="(value, i) in typeDef.enum" :key="value" class="font-monospace">
          "{{ value }}"<span v-if="i < typeDef.enum.length - 1"> | </span>
        </code>
      </p>
      <table v-if="typeDef.properties.length && !compact" class="table table-sm table-bordered mb-0">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="prop in typeDef.properties" :key="prop.name">
            <td>
              <code class="font-monospace">{{ prop.name }}</code>
              <span v-if="prop.optional" class="text-muted">?</span>
              <span v-if="prop.nullable" class="text-muted"> | null</span>
            </td>
            <td><code class="font-monospace">{{ typeLabel(prop.type) }}</code></td>
            <td>{{ prop.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>
