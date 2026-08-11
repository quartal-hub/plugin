import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import qrtlPlugin from "@quartal/plugin/astro";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  // Quartal IAM. Tools receive a QuartalPluginContext and map it to a Salaxy session via
  // src/lib/salaxyContext.ts (stub — implement with the Salaxy libraries).
  integrations: [qrtlPlugin({ auth: "quartal-iam" })],
});
