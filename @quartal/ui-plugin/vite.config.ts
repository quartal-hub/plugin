import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";

const isLibBuild = process.env.npm_lifecycle_event === "build";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src/index.ts"),
      name: "QuartalUiPlugin",
      formats: ["es"],
      fileName: "index",
    },
    rolldownOptions: {
      external: ["vue", "vue-router"],
      output: {
        globals: { vue: "Vue", "vue-router": "VueRouter" },
      },
    },
  },
  plugins: [
    vue(),
    ...(isLibBuild
      ? [
        dts({
          tsconfigPath: "./tsconfig.dts.json",
          bundleTypes: true,
          cleanVueFileName: true,
        }),
      ]
      : []),
  ],
  // `@quartal/plugin-core` resolves to the built package (a dependency), not to its workspace
  // sources: the declaration bundle must import it by package name, and the plugin rewrites
  // declaration imports through Vite aliases. Storybook aliases it to the sources in .storybook/main.ts.
});
