/**
 * Entry of the `widgets.js` bundle every plugin serves. The plugin replaces the config placeholder
 * with its route table when it serves the file (see `renderWidgetsScript`); the plugin origin is
 * where the script was loaded from. Loading it registers the plugin and defines `<qrtl-widget>`.
 *
 * Bundled by `scripts/bundleWidgetsScript.mjs`; not part of the package's compiled modules.
 */
import type { WidgetRoutes } from "../model/index.ts";
import { connectPlugin } from "../client/connectPlugin.ts";
import { defineWidgetElement } from "../element/QrtlWidgetElement.ts";
import { registerPlugin } from "../element/pluginRegistry.ts";

const routes = JSON.parse("__QRTL_WIDGETS_CONFIG__") as WidgetRoutes;

/** The plugin that served this script. Call `plugin.setAuth({ getToken })` to sign its calls. */
export const plugin = registerPlugin(connectPlugin({ url: new URL(import.meta.url).origin, routes }));

defineWidgetElement();

export { connectPlugin };
