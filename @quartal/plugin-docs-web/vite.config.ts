import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

const vueRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const pluginCoreRoot = path.resolve(vueRoot, "../plugin-core/src");
const uiPluginRoot = path.resolve(vueRoot, "../ui-plugin/src");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_HUB_API_PROXY ?? "http://localhost:4321";

  return {
    plugins: [vue()],
    resolve: {
      // ui-plugin is aliased to source; dedupe avoids a second vue-router copy breaking useRoute/RouterLink.
      dedupe: ["vue", "vue-router"],
      alias: {
        "@quartal/plugin-core": path.join(pluginCoreRoot, "mod.ts"),
        "@quartal/ui-plugin": path.join(uiPluginRoot, "index.ts"),
      },
    },
    server: {
      port: Number(env.VITE_DEV_PORT ?? 5173),
      proxy: {
        "/plugin.json": apiTarget,
        "/open-api.json": apiTarget,
        "/types.json": apiTarget,
        "/mcp-server.json": apiTarget,
        "/skills": apiTarget,
        "/readme.md": apiTarget,
        "/api": apiTarget,
        "/mcp": apiTarget,
        "/icons": apiTarget,
        "/favicon.ico": apiTarget,
        // Plugin `public/` files (e.g. README screenshots at /screen-shots/*.png)
        "^/.*\\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|eot|mp4|webm)$": apiTarget,
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
