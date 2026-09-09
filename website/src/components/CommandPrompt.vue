<script lang="ts">
import { ref } from "vue";

type Pm = "pnpm" | "npm";

const PM_STORAGE_KEY = "quartal-plugins.package-manager";

/**
 * Module-level so the selection is shared by every CommandPrompt instance on
 * the page; persisted to localStorage so it sticks across pages and visits.
 * Undefined until the user (now or on an earlier visit) has made a choice.
 */
const selectedPm = ref<Pm | undefined>(undefined);
</script>

<script setup lang="ts">
import { computed, onMounted } from "vue";

const props = defineProps<{
  /** The command(s) to show, one per line, written in either pnpm or npm form. */
  command: string;
}>();

/** npm subcommands that exist as-is; anything else after `pnpm` is a script shortcut needing `npm run`. */
const NPM_COMMANDS =
  /^(create|install|i|run|exec|test|start|stop|init|publish|update|remove|uninstall|link|why|list|ls|outdated|audit|pack|version|config)$/;

/** pnpm-specific terms and their npm equivalents; `node` and other commands pass through unchanged. */
function toNpm(cmd: string): string {
  return cmd
    .replace(/\bpnpm dlx\b/g, "npx")
    .replace(/\bpnpm add\b/g, "npm install")
    // Bare script shortcuts (`pnpm dev`) need an explicit `run` in npm.
    .replace(/\bpnpm ([\w:-]+)/g, (m, sub) => (NPM_COMMANDS.test(sub) ? m : `pnpm run ${sub}`))
    .replace(/\bpnpm\b/g, "npm");
}

function toPnpm(cmd: string): string {
  return cmd
    .replace(/\bnpx\b/g, "pnpm dlx")
    .replace(/\bnpm\b/g, "pnpm");
}

const isPnpmSource = /\bpnpm\b/.test(props.command);
const variants = computed(() => ({
  pnpm: isPnpmSource ? props.command : toPnpm(props.command),
  npm: isPnpmSource ? toNpm(props.command) : props.command,
}));

const active = computed<Pm>(() => selectedPm.value ?? (isPnpmSource ? "pnpm" : "npm"));
const activeCode = computed(() => variants.value[active.value]);

/** Commands are one-liners with trivial syntax, so highlight just the tool names instead of a full editor. */
const highlighted = computed(() =>
  activeCode.value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\b(pnpm|npm|npx|node)\b/g, '<span class="qcp-cmd">$1</span>'),
);

// Read the stored choice after mount (not at module scope) so islands that are
// server-rendered hydrate against the markup they were built with.
onMounted(() => {
  if (selectedPm.value) return;
  try {
    const stored = localStorage.getItem(PM_STORAGE_KEY);
    if (stored === "pnpm" || stored === "npm") selectedPm.value = stored;
  } catch {
    /* storage unavailable (e.g. blocked); keep the authored default */
  }
});

function select(pm: Pm) {
  selectedPm.value = pm;
  try {
    localStorage.setItem(PM_STORAGE_KEY, pm);
  } catch {
    /* storage unavailable; the shared ref still updates this page */
  }
}

const copied = ref(false);
async function copy() {
  await navigator.clipboard.writeText(activeCode.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <div class="q-command-prompt card overflow-hidden text-start">
    <div class="d-flex align-items-center gap-1 px-2 py-1 bg-dark">
      <button
        v-for="pm in (['pnpm', 'npm'] as const)"
        :key="pm"
        type="button"
        class="btn btn-sm py-0 px-2 border-0"
        :class="active === pm ? 'btn-light fw-semibold' : 'text-light'"
        @click="select(pm)"
      >
        {{ pm }}
      </button>
      <button
        type="button"
        class="btn btn-sm py-0 px-2 border-0 ms-auto text-light"
        :title="copied ? 'Copied!' : 'Copy to clipboard'"
        @click="copy"
      >
        <i class="bi" :class="copied ? 'bi-check2' : 'bi-clipboard'"></i>
      </button>
    </div>
    <pre class="qcp-code m-0 px-3 py-2 bg-black text-light"><code v-html="highlighted"></code></pre>
  </div>
</template>

<style scoped>
.qcp-code {
  font-size: 0.85rem;
  line-height: 1.6;
  overflow-x: auto;
  /* .qp-doc pre rounds markdown code blocks; inside the card the card's own radius applies. */
  border-radius: 0;
}
.qcp-code :deep(.qcp-cmd) {
  color: color-mix(in srgb, var(--bs-primary) 70%, white);
  font-weight: 600;
}
</style>
