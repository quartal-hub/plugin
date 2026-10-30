import { defineConfig } from "vite";

export default defineConfig({
  // The page awaits the plugin's widgets.js at the top level of its module.
  build: { target: "es2022" },
});
