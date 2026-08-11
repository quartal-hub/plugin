import { createPluginClient } from "@quartal/plugin-core";

/** Configured client for the plugin API (respects Vite proxy / env in dev). */
export const pluginClient = createPluginClient({
  baseUrl: (import.meta.env.VITE_HUB_API_URL ?? "").replace(/\/$/, ""),
});
