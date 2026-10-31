/**
 * `@quartal/plugin-embed/react` — React bindings: the {@link PluginWidget} component and the
 * {@link usePluginTool} hook.
 * @module
 */
export { PluginWidget, type PluginWidgetProps } from "./PluginWidget.ts";
export { type PluginToolState, usePluginTool, type UsePluginToolOptions } from "./usePluginTool.ts";
export { connectPlugin } from "../client/connectPlugin.ts";
export { pluginConnection } from "../element/pluginRegistry.ts";
