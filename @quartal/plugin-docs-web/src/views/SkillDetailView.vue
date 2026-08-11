<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import {
  npxSkillsAddCommand,
  type PluginInfo,
  type SkillFileWithUrl,
  type SkillsCatalogResponse,
} from "@quartal/plugin-core";
import FileTree from "../components/FileTree.vue";
import CopyButton from "../components/CopyButton.vue";
import { pluginClient } from "../lib/pluginClient.ts";

const props = defineProps<{ name: string; plugin: PluginInfo | null }>();

const catalog = ref<SkillsCatalogResponse | null>(null);
const skill = computed(() => catalog.value?.skills.find((s) => s.name === props.name));
const selected = ref<SkillFileWithUrl | null>(null);
const preview = ref("");
const previewLang = ref("text");
const previewError = ref("");
const loadError = ref("");

const npxCmd = computed(() => {
  if (!skill.value) return null;
  return npxSkillsAddCommand(props.plugin?.repository, skill.value.name);
});

onMounted(loadCatalog);

watch(() => props.name, loadCatalog);

watch(skill, (s) => {
  if (s) {
    const md = s.files.find((f) => f.path === "SKILL.md");
    if (md) selectFile(md);
  }
});

async function loadCatalog() {
  loadError.value = "";
  try {
    catalog.value = await pluginClient.getSkillsCatalog();
    if (!skill.value) loadError.value = `Unknown skill: ${props.name}`;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

function getPreviewLang(file: SkillFileWithUrl): string {
  const ext = file.path.split(".").pop()?.toLowerCase();
  // TODO: Probably add @quartal/core OR add name to pass forresolving in code editor.
  switch (ext) {
    case "md": return "markdown";
    case "txt": return "text";
    case "json": return "json";
    case "ts": return "typescript";
    case "js": return "javascript";
    case "mjs": return "javascript";
    case "yaml": return "yaml";
    case "yml": return "yaml";
    case "csv": return "csv";
    case "xml": return "xml";
    case "html": return "html";
    case "css": return "css";
    case "sh": return "sh";
    case "ps1": return "ps1";
    case "py": return "py";
    default: return "text";
  }
}
async function selectFile(file: SkillFileWithUrl) {
  selected.value = file;
  preview.value = "Loading…";
  previewError.value = "";
  try {
    preview.value = await pluginClient.fetchSkillFile(file.url);
    previewLang.value = getPreviewLang(file);
  } catch (e) {
    previewError.value = e instanceof Error ? e.message : String(e);
    preview.value = "";
  }
}
</script>

<template>
  <div>
    <p><RouterLink to="/skills">&laquo; All skills</RouterLink></p>

    <div v-if="loadError" class="alert alert-danger">{{ loadError }}</div>

    <template v-if="skill">
      <h1>{{ skill.name }}</h1>
      <p class="lead">{{ skill.description }}</p>

      <div class="d-flex flex-wrap gap-2 mb-3">
        <a class="btn btn-sm btn-outline-primary" :href="skill.urls.zip">Download .zip</a>
        <a class="btn btn-sm btn-outline-primary" :href="skill.urls.skill">Download .skill</a>
      </div>
      <div v-if="npxCmd" class="mb-3 small">
        <code>{{ npxCmd }}</code>
        <CopyButton :text="npxCmd" />
      </div>

      <div class="row">
        <div class="col-md-4">
          <h2 class="h6">Files</h2>
          <FileTree :key="name" :files="skill.files" :selected-path="selected?.path" @select="selectFile" />
        </div>
        <div class="col-md-8">
          <h2 class="h6">{{ selected?.path ?? "Select a file" }}</h2>
          <div v-if="previewError" class="alert alert-warning">{{ previewError }}</div>
          <div v-else style="height: 480px;">
            <qrtl-editor type="monaco" read-only :lang="previewLang" :code="preview"></qrtl-editor>
          </div>
          <p v-if="selected" class="small text-muted mt-2">
            <a :href="selected.url" target="_blank" rel="noopener">Open raw</a>
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
