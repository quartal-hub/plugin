import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import qrtlPlugin from "@quartal/plugin/astro";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [vue(), qrtlPlugin()],
});
