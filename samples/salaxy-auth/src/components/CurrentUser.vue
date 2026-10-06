<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useExtApps } from "@quartal/plugin-vue";
import type { CurrentUser } from "../tools/model/index.ts";

/** Bump to reload the user and company, e.g. after another company is selected. */
const props = defineProps<{ refreshKey?: number }>();

const { callTool } = useExtApps({ name: "SalaxyCurrentUser", version: "0.1.0" });
const user = ref<CurrentUser | null>(null);

async function load(): Promise<void> {
  try {
    user.value = await callTool<CurrentUser>("getCurrentUser");
  } catch {
    // Not fatal: the widget works without the identity header (e.g. in a plain browser preview).
    user.value = null;
  }
}

onMounted(load);
watch(() => props.refreshKey, load);
</script>

<template>
  <div v-if="user" class="d-flex align-items-center small text-muted mb-3 q-current-user">
    <img v-if="user.avatar.url" :src="user.avatar.url" :alt="user.displayName" class="rounded-circle me-2" width="24" height="24" />
    <span
      v-else
      class="rounded-circle me-2 d-inline-flex align-items-center justify-content-center text-white"
      :style="{ backgroundColor: user.avatar.color || 'gray', width: '24px', height: '24px', fontSize: '11px' }"
    >{{ user.avatar.initials || "?" }}</span>
    <span>
      Signed in as <strong>{{ user.displayName }}</strong>
      <template v-if="user.email && user.email !== user.displayName"> ({{ user.email }})</template>
      <template v-if="user.company"> · working in <strong>{{ user.company.name }}</strong></template>
      <template v-else> · no company selected</template>
    </span>
  </div>
</template>
