<script setup lang="ts">
import { ref } from "vue";

import { copyText } from "../lib/copyText.ts";

/** The prompt copied for the user's coding agent (Claude Code, Cursor, Copilot, Codex, ...). */
const PROMPT = `Create a new Quartal Plugin for me (docs: https://plugin.quartal.com) — an Astro app where plain TypeScript classes become MCP tools, a REST API, chat widgets and Agent Skills. Ask me what the plugin should do and what to name it, then:

1. Scaffold it non-interactively:
   pnpm create @quartal/plugin <name> --yes
   (with npm, flags go after "--": npm create @quartal/plugin -- <name> --yes)
   Options: --description "<one-liner>", --auth for Quartal Hub OAuth2 (default is anonymous),
   --no-sample-tool, --widgets none|vue|react|js (default vue).
2. Run it: cd <name> && pnpm install && pnpm dev — http://localhost:4321 serves the plugin's
   docs site at /, MCP at /mcp, REST at /api/<Class>/<method>.
3. Fetch https://plugin.quartal.com/llms.txt for the documentation index and read the pages you
   need before writing code. The scaffolded AGENTS.md has the project conventions.
4. Implement my tools as classes in src/tools/, exported from src/tools/mod.ts. TypeScript types
   and JSDoc are the schemas — do not hand-write schemas or add a schema library. Replace the
   HelloWorld sample.
5. Verify: pnpm build succeeds and the tools respond over MCP at http://localhost:4321/mcp.`;

const copied = ref(false);
const open = ref(false);

async function copy() {
  if (!(await copyText(PROMPT))) {
    // Copying is blocked (e.g. an embedded browser): show the text so it can be selected.
    open.value = true;
    return;
  }
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
</script>

<!--
  Two root nodes on purpose: the Astro island wrapper is `display: contents`, so both become
  direct items of the hero's `d-flex flex-wrap` button row — the buttons stay inline with their
  siblings, and the opened prompt (`w-100 order-last`) wraps onto its own line under ALL buttons
  instead of stretching the row.
-->
<template>
  <div class="q-agent-prompt d-flex align-items-center gap-2">
    <button type="button" class="btn btn-lg btn-outline-light" @click="copy">
      <i class="bi me-1" :class="copied ? 'bi-check2' : 'bi-stars'"></i>
      {{ copied ? "Copied — paste it to your agent" : "Copy for coding agent" }}
    </button>
    <button
      type="button"
      class="btn btn-sm text-light border-0 opacity-75"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ open ? "hide" : "view" }}
    </button>
  </div>
  <pre v-if="open" class="qap-prompt order-last w-100 text-start text-light mt-2 p-3 mb-0">{{ PROMPT }}</pre>
</template>

<style scoped>
.qap-prompt {
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
  background: rgba(0, 0, 0, 0.35);
  border-radius: var(--bs-border-radius);
  max-width: 44rem;
  max-height: 16rem;
  overflow-y: auto;
}
</style>
