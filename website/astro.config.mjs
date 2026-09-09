import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";

// Static marketing + docs site; no adapter needed (deployable to any static host).
export default defineConfig({
  site: "https://plugin.quartal.com",
  integrations: [
    vue({
      template: {
        compilerOptions: {
          // <qrtl-editor> & co. from code.quartal.com are web components, not Vue components.
          isCustomElement: (tag) => tag.startsWith("qrtl-"),
        },
      },
    }),
  ],
});
