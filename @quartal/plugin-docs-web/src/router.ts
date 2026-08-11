import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import ApiView from "./views/ApiView.vue";
import McpView from "./views/McpView.vue";
import SkillsView from "./views/SkillsView.vue";
import SkillDetailView from "./views/SkillDetailView.vue";
import ToolsView from "./views/ToolsView.vue";
import ToolGroupView from "./views/ToolGroupView.vue";
import ToolDetailView from "./views/ToolDetailView.vue";
import WidgetsView from "./views/WidgetsView.vue";
import ResourcesView from "./views/ResourcesView.vue";
import PromptsView from "./views/PromptsView.vue";

/** Hash routing: works with refresh, direct links, and embedding on hosts with their own path router. */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/tools", name: "tools", component: ToolsView },
    {
      path: "/tools/:className",
      name: "toolGroup",
      component: ToolGroupView,
      props: (route) => ({ className: route.params.className }),
    },
    {
      path: "/tools/:className/:methodName",
      name: "tool",
      component: ToolDetailView,
      props: (route) => ({
        className: route.params.className,
        methodName: route.params.methodName,
      }),
    },
    { path: "/skills", name: "skills", component: SkillsView },
    { path: "/skills/:name", name: "skill", component: SkillDetailView, props: true },
    { path: "/widgets", name: "widgets", component: WidgetsView },
    { path: "/resources", name: "resources", component: ResourcesView },
    { path: "/prompts", name: "prompts", component: PromptsView },
    { path: "/api", name: "api", component: ApiView },
    { path: "/api/swagger", name: "apiSwagger", component: () => import("./views/SwaggerView.vue") },
    { path: "/api/redoc", name: "apiRedoc", component: () => import("./views/ReDocView.vue") },
    { path: "/mcp", name: "mcp", component: McpView },
  ],
});
