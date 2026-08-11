<script setup lang="ts">
const props = defineProps<{ text: string; label?: string }>();

async function copy() {
  try {
    await navigator.clipboard.writeText(props.text);
  } catch {
    const t = document.createElement("textarea");
    t.value = props.text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    document.body.removeChild(t);
  }
}
</script>

<template>
  <button type="button" class="btn btn-sm btn-link" @click="copy" title="Copy to clipboard">
    <i class="bi bi-copy"></i>
  </button>
</template>
