/**
 * `@quartal/plugin-embed` — embed Quartal Plugin widgets in any web page. A dependency-free MCP Apps
 * host ({@link createWidgetHost}), a REST client for a plugin's tools ({@link connectPlugin}) and
 * widget mounting. The `<qrtl-widget>` element is at `@quartal/plugin-embed/element`, React bindings
 * at `/react` and Vue bindings at `/vue`.
 * @module
 */
export { connectPlugin, WIDGET_ROUTES_PATH } from "./client/connectPlugin.ts";
export { buildToolRequest } from "./client/buildToolRequest.ts";
export { mountPluginWidget, WIDGET_IFRAME_SANDBOX } from "./client/mountPluginWidget.ts";
export { PluginToolError } from "./client/PluginToolError.ts";
export {
  createWidgetHost,
  SUPPORTED_PROTOCOL_VERSIONS,
  type WidgetHost,
  type WidgetHostOptions,
} from "./host/createWidgetHost.ts";
export { errorToolResult, jsonToolResult, readToolResult } from "./host/toolResults.ts";
export type {
  CallToolOptions,
  CallToolResult,
  ConnectPluginOptions,
  ContentBlock,
  MountedWidget,
  MountWidgetOptions,
  PluginAuth,
  PluginConnection,
  TokenProvider,
  ToolRoute,
  ToolRouteMethod,
  WidgetCallbacks,
  WidgetDisplayMode,
  WidgetHostContext,
  WidgetLogEntry,
  WidgetMessage,
  WidgetModelContext,
  WidgetRouteEntry,
  WidgetRoutes,
  WidgetSize,
  WidgetTheme,
  WidgetToolCall,
  WidgetToolResult,
} from "./model/index.ts";
