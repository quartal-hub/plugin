import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";

// Static marketing + docs site; no adapter needed (deployable to any static host).
export default defineConfig({
  site: "https://plugin.quartal.com",
  // Astro 7 defaults to `'jsx'`, which drops whitespace around newline-separated inline elements
  // (prose like `…a dynamic <a>Astro</a> site`). Keep the HTML-spec-aware compression.
  compressHTML: true,
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
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          // The skin (src/styles/quartal.scss) is Bootstrap 5 @import-style Sass; Bootstrap 5.3
          // itself still raises these deprecations. They are not ours to fix until Bootstrap moves on.
          quietDeps: true,
          silenceDeprecations: ["import", "global-builtin", "color-functions", "if-function"],
        },
      },
    },
  },
});
