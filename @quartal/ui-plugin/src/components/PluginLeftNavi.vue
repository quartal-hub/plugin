<script setup lang="ts">
import { ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import type { PluginInfo } from "@quartal/plugin-core";

defineProps<{
  plugin: PluginInfo;
}>();

const route = useRoute();
/** null = follow route; "" = all collapsed; otherwise the open section id. */
const openSection = ref<string | null>(null);

watch(
  () => route.path,
  () => {
    openSection.value = null;
  },
);

function toggleSection(section: string) {
  if (isSectionOpen(section)) {
    openSection.value = "";
  } else {
    openSection.value = section;
  }
}

function isSectionOpen(section: string): boolean {
  if (openSection.value === "") return false;
  if (openSection.value !== null) return openSection.value === section;
  return isSectionActive(section);
}

function isSectionActive(section: string): boolean {
  const path = route.path;
  switch (section) {
    case "tools":
      return path.startsWith("/tools");
    case "skills":
      return path.startsWith("/skills");
    case "widgets":
      return path.startsWith("/widgets");
    case "prompts":
      return path.startsWith("/prompts");
    case "api":
      return path.startsWith("/api");
    default:
      return false;
  }
}

function countEnabled(count: number): boolean {
  return count > 0;
}
</script>

<template>
  <nav class="q-plugin-left-navi">
    <div class="list-group">
      <RouterLink
        to="/"
        class="list-group-item list-group-item-action text-truncate"
        :class="{ active: route.path === '/' }"
      >
        About {{ plugin.title }}
      </RouterLink>

      <div class="list-group-item p-0 border-0">
        <button
          type="button"
          class="list-group-item list-group-item-action w-100 d-flex justify-content-between align-items-center"
          :class="{ active: isSectionActive('tools') }"
          :disabled="!countEnabled(plugin.tools?.length)"
          @click="toggleSection('tools')"
        >
          <span>Tools
            <span v-if="plugin.tools?.length" class="badge bg-primary rounded-pill ms-1">{{ plugin.tools.length }}</span>
          </span>
          <i class="bi" :class="isSectionOpen('tools') ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </button>
        <div v-show="isSectionOpen('tools') && plugin.toolGroups.length" class="list-group list-group-flush border-start ms-2">
          <template v-for="group in plugin.toolGroups" :key="group.className">
            <RouterLink
              :to="{ name: 'toolGroup', params: { className: group.className } }"
              class="list-group-item list-group-item-action py-1 ps-3 text-truncate fw-semibold"
              :class="{ active: route.params.className === group.className && !route.params.methodName }"
            >
              {{ group.className }}
              <span class="badge bg-secondary rounded-pill ms-1">{{ group.tools.length }}</span>
            </RouterLink>
            <RouterLink
              v-for="tool in group.tools"
              :key="`${group.className}.${tool.name}`"
              :to="{ name: 'tool', params: { className: group.className, methodName: tool.name } }"
              class="list-group-item list-group-item-action py-0 ps-4 text-truncate"
              :class="{ active: route.params.className === group.className && route.params.methodName === tool.name }"
            >
              {{ tool.summary || tool.name }}
            </RouterLink>
          </template>
        </div>
      </div>

      <div class="list-group-item p-0 border-0">
        <button
          type="button"
          class="list-group-item list-group-item-action w-100 d-flex justify-content-between align-items-center"
          :class="{ active: isSectionActive('skills') }"
          :disabled="!countEnabled(plugin.skills.length)"
          @click="toggleSection('skills')"
        >
          <span>Skills
            <span v-if="plugin.skills.length" class="badge bg-primary rounded-pill ms-1">{{ plugin.skills.length }}</span>
          </span>
          <i class="bi" :class="isSectionOpen('skills') ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </button>
        <div v-show="isSectionOpen('skills') && plugin.skills.length" class="list-group list-group-flush border-start ms-2">
          <RouterLink
            v-for="skill in plugin.skills"
            :key="skill.name"
            :to="{ name: 'skill', params: { name: skill.name } }"
            class="list-group-item list-group-item-action py-0 ps-3 text-truncate"
            :class="{ active: route.params.name === skill.name }"
          >
            {{ skill.name }}
          </RouterLink>
        </div>
      </div>

      <div class="list-group-item p-0 border-0">
        <button
          type="button"
          class="list-group-item list-group-item-action w-100 d-flex justify-content-between align-items-center"
          :class="{ active: isSectionActive('widgets') }"
          :disabled="!countEnabled(plugin.widgets.length)"
          @click="toggleSection('widgets')"
        >
          <span>Widgets
            <span v-if="plugin.widgets.length" class="badge bg-primary rounded-pill ms-1">{{ plugin.widgets.length }}</span>
          </span>
          <i class="bi" :class="isSectionOpen('widgets') ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </button>
        <div v-show="isSectionOpen('widgets') && plugin.widgets.length" class="list-group list-group-flush border-start ms-2">
          <RouterLink
            v-for="widget in plugin.widgets"
            :key="widget.toolId"
            :to="{ name: 'widgets' }"
            class="list-group-item list-group-item-action py-0 ps-3 text-truncate"
          >
            {{ widget.title }}
          </RouterLink>
        </div>
      </div>

      <RouterLink
        to="/resources"
        class="list-group-item list-group-item-action text-truncate d-flex justify-content-between align-items-start"
        :class="{ disabled: !countEnabled(plugin.resources.length), active: route.path === '/resources' }"
      >
        Resources
        <span v-if="plugin.resources.length" class="badge bg-primary rounded-pill">{{ plugin.resources.length }}</span>
      </RouterLink>

      <div class="list-group-item p-0 border-0">
        <button
          type="button"
          class="list-group-item list-group-item-action w-100 d-flex justify-content-between align-items-center"
          :class="{ active: isSectionActive('prompts') }"
          :disabled="!countEnabled(plugin.prompts.length)"
          @click="toggleSection('prompts')"
        >
          <span>Prompts
            <span v-if="plugin.prompts.length" class="badge bg-primary rounded-pill ms-1">{{ plugin.prompts.length }}</span>
          </span>
          <i class="bi" :class="isSectionOpen('prompts') ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </button>
        <div v-show="isSectionOpen('prompts') && plugin.prompts.length" class="list-group list-group-flush border-start ms-2">
          <RouterLink
            v-for="prompt in plugin.prompts"
            :key="prompt.name"
            :to="{ name: 'prompt', params: { promptName: prompt.name } }"
            class="list-group-item list-group-item-action py-0 ps-3 text-truncate"
            :class="{ active: route.params.promptName === prompt.name }"
          >
            {{ prompt.summary || prompt.name }}
          </RouterLink>
        </div>
      </div>

      <div class="list-group-item p-0 border-0">
        <button
          type="button"
          class="list-group-item list-group-item-action w-100 d-flex justify-content-between align-items-center"
          :class="{ active: isSectionActive('api') }"
          @click="toggleSection('api')"
        >
          <span>Rest API</span>
          <i class="bi" :class="isSectionOpen('api') ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </button>
        <div v-show="isSectionOpen('api')" class="list-group list-group-flush border-start ms-2">
          <RouterLink
            to="/api"
            class="list-group-item list-group-item-action py-0 ps-3 text-truncate"
            :class="{ active: route.path === '/api' }"
          >
            Overview
          </RouterLink>
          <RouterLink
            to="/api/swagger"
            class="list-group-item list-group-item-action py-0 ps-3 text-truncate"
            :class="{ active: route.path === '/api/swagger' }"
          >
            Swagger UI
          </RouterLink>
          <RouterLink
            to="/api/redoc"
            class="list-group-item list-group-item-action py-0 ps-3 text-truncate"
            :class="{ active: route.path === '/api/redoc' }"
          >
            ReDoc
          </RouterLink>
        </div>
      </div>

      <RouterLink
        to="/mcp"
        class="list-group-item list-group-item-action text-truncate"
        :class="{ active: route.path === '/mcp' }"
      >
        MCP Server
      </RouterLink>
    </div>
  </nav>
</template>
