import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";

// Static marketing + docs site; no adapter needed (deployable to any static host).
export default defineConfig({
  site: "https://plugins.quartal.com",
  integrations: [vue()],
});
