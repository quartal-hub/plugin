<script setup lang="ts">
import type { PluginPromptEntry } from "@quartal/plugin-core";

defineProps<{
  prompt: PluginPromptEntry;
}>();
</script>

<template>
  <article class="q-plugin-prompt-detail">
    <header class="mb-4">
      <p class="text-muted small mb-1 font-monospace">{{ prompt.className }}.{{ prompt.methodName }}</p>
      <h1 class="h3 mb-2">{{ prompt.summary || prompt.name }}</h1>
      <p v-if="prompt.description" class="lead">{{ prompt.description }}</p>
      <div class="d-flex flex-wrap gap-2">
        <span class="badge text-bg-primary">MCP prompt: {{ prompt.name }}</span>
      </div>
    </header>

    <section class="mb-4">
      <h2 class="h5">Arguments</h2>
      <table v-if="prompt.arguments.length" class="table table-sm table-bordered">
        <thead>
          <tr>
            <th>Name</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="arg in prompt.arguments" :key="arg.name">
            <td><code class="font-monospace">{{ arg.name }}</code></td>
            <td>
              <span v-if="arg.required" class="badge text-bg-warning">required</span>
              <span v-else class="text-muted">optional</span>
            </td>
            <td>{{ arg.description }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="text-muted mb-0">This prompt takes no arguments.</p>
    </section>
  </article>
</template>
