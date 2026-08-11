<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  npxSkillsAddCommand,
  type PluginInfo,
  type SkillsCatalogResponse,
} from "@quartal/plugin-core";
import { pluginClient } from "../lib/pluginClient.ts";
import CopyButton from "../components/CopyButton.vue";

const props = defineProps<{ plugin: PluginInfo | null }>();

const catalog = ref<SkillsCatalogResponse | null>(null);
const error = ref("");

onMounted(async () => {
  try {
    catalog.value = await pluginClient.getSkillsCatalog();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});

function npxCmd(skillName: string): string | null {
  return npxSkillsAddCommand(props.plugin?.repository, skillName);
}
</script>

<template>
  <div>
    <h1>Agent Skills</h1>
    <p class="lead">
      Skills in this plugin (<a :href="pluginClient.url('/skills/catalog.json')" target="_blank" rel="noopener">catalog.json</a>).
    </p>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <div v-if="catalog && catalog.skills.length === 0" class="text-muted">
      No skills. Add <code>skills/&lt;name&gt;/SKILL.md</code> folders to the plugin.
    </div>

    <div v-for="skill in catalog?.skills ?? []" :key="skill.name" class="card mb-3">
      <div class="card-body">
        <h2 class="h5">
          <RouterLink :to="{ name: 'skill', params: { name: skill.name } }">{{ skill.name }}</RouterLink>
        </h2>
        <p>{{ skill.description }}</p>
        <div class="d-flex flex-wrap gap-2 mb-2">
          <RouterLink class="btn btn-sm btn-primary" :to="{ name: 'skill', params: { name: skill.name } }">
            View files
          </RouterLink>
          <a class="btn btn-sm btn-outline-primary" :href="skill.urls.zip">Download .zip</a>
          <a class="btn btn-sm btn-outline-primary" :href="skill.urls.skill">Download .skill</a>
        </div>
        <div v-if="npxCmd(skill.name)" class="small">
          <code>{{ npxCmd(skill.name) }}</code>
          <CopyButton :text="npxCmd(skill.name)!" />
        </div>
      </div>
    </div>
  </div>
</template>
