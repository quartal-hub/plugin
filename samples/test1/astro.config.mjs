import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import qrtlPlugin from "@quartal/plugin/astro";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [qrtlPlugin({ auth: "anon" })],
});
