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
        "/plugin.zip": apiTarget,
        "/mcp.json": apiTarget,
        "/com.quartal.plugin": apiTarget,
        "/open-api.json": apiTarget,
        "/types.json": apiTarget,
        "/mcp-server.json": apiTarget,
        "/skills": apiTarget,
        "/agents": apiTarget,
        "/readme.md": apiTarget,
        "/api": apiTarget,
        "/mcp": apiTarget,
        "/icons": apiTarget,
        "/favicon.ico": apiTarget,
        // Plugin `public/` files (e.g. README screenshots at /screen-shots/*.png)
        "^/.*\\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|eot|mp4|webm)$": apiTarget,
      },
    },
    // Library build: a self-contained ES module (vue, router, redoc/swagger chunks bundled) that
    // the website's /plugin-index page imports. `vite dev` still serves index.html for local SPA
    // development against the proxy above.
    build: {
      outDir: "dist",
      emptyOutDir: true,
      cssCodeSplit: false,
      lib: {
        entry: path.join(vueRoot, "src/mount.ts"),
        formats: ["es"],
        fileName: "plugin-docs-web",
        cssFileName: "plugin-docs-web",
      },
    },
  };
});
