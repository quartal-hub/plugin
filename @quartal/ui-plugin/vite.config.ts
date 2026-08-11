import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";

const pluginCoreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../plugin-core/src");
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
    rollupOptions: {
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
          rollupTypes: true,
          cleanVueFileName: true,
        }),
      ]
      : []),
  ],
  resolve: {
    alias: {
      "@quartal/plugin-core": path.join(pluginCoreRoot, "mod.ts"),
    },
  },
});
