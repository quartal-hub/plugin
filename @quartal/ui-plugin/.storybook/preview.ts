import type { Preview, StoryFn } from "@storybook/vue3-vite";
import { setup } from "@storybook/vue3";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineComponent, h } from "vue";

import { loadDefaultSkin } from "../src/helpers/loadSkin.ts";
import "../src/styles/ui-plugin.css";

loadDefaultSkin();

const storyRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", name: "home", component: { template: "<div />" } },
    { path: "/tools", name: "tools", component: { template: "<div />" } },
    { path: "/tools/:className", name: "toolGroup", component: { template: "<div />" } },
    { path: "/skills", name: "skills", component: { template: "<div />" } },
    { path: "/tools/:className/:methodName", name: "tool", component: { template: "<div />" } },
    { path: "/skills/:name", name: "skill", component: { template: "<div />" } },
    { path: "/widgets", name: "widgets", component: { template: "<div />" } },
    { path: "/resources", name: "resources", component: { template: "<div />" } },
    { path: "/prompts", name: "prompts", component: { template: "<div />" } },
    { path: "/api", name: "api", component: { template: "<div />" } },
    { path: "/api/swagger", name: "apiSwagger", component: { template: "<div />" } },
    { path: "/api/redoc", name: "apiRedoc", component: { template: "<div />" } },
    { path: "/mcp", name: "mcp", component: { template: "<div />" } },
  ],
});

setup((app) => {
  app.use(storyRouter);
});

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (story: StoryFn) => {
      const Wrapper = defineComponent({
        setup() {
          return () =>
            h("div", { class: "container py-4" }, [
              h(story()),
            ]);
        },
      });
      return () => h(Wrapper);
    },
  ],
};

export default preview;
