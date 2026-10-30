/**
 * `@quartal/plugin-embed/script` — the `widgets.js` bundle as a string, for plugins to serve.
 * @module
 */
import type { WidgetRoutes } from "../model/index.ts";
import { WIDGETS_SCRIPT_SOURCE } from "./widgetsScriptSource.ts";

/** The placeholder in {@link WIDGETS_SCRIPT_SOURCE} that {@link renderWidgetsScript} replaces. */
export const WIDGETS_SCRIPT_CONFIG_PLACEHOLDER = "__QRTL_WIDGETS_CONFIG__";

/**
 * The `widgets.js` module for one plugin: the bundle with the plugin's route table baked in. Serve
 * it as `text/javascript` with `Access-Control-Allow-Origin: *` (pages load it as a module script,
 * which is a CORS request).
 * @param routes The plugin's route table.
 */
export function renderWidgetsScript(routes: WidgetRoutes): string {
  const literal = JSON.stringify(JSON.stringify(routes));
  return WIDGETS_SCRIPT_SOURCE.replace(new RegExp(`(["'\`])${WIDGETS_SCRIPT_CONFIG_PLACEHOLDER}\\1`), () => literal);
}

export { WIDGETS_SCRIPT_SOURCE };
