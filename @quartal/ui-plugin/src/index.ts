export { DEFAULT_SKIN_URL, loadDefaultSkin, loadSkin } from "./helpers/loadSkin.ts";

export {
  buildArgsFromForm,
  buildExampleArgs,
  buildFormFields,
  connectMcpClient,
  type FormControl,
  type FormField,
  type FormModel,
  initFormModel,
  type JsonSchema,
  listMcpTools,
  type McpToolInfo,
  prettyJson,
  readWidgetHtml,
  toolResultToValue,
} from "./helpers/mcpToolTester.ts";
export {
  mountWidget,
  type MountWidgetOptions,
  type WidgetHostCallbacks,
  type WidgetHostHandle,
  type WidgetLogEntry,
  type WidgetTheme,
} from "./helpers/mcpWidgetHost.ts";

export { default as McpToolTester } from "./components/McpToolTester.vue";
export { default as McpWidget } from "./components/McpWidget.vue";

export { default as PluginAbout } from "./components/PluginAbout.vue";
export { default as PluginLeftNavi } from "./components/PluginLeftNavi.vue";
export { default as PluginSummary } from "./components/PluginSummary.vue";
export { default as PluginToolDetail } from "./components/PluginToolDetail.vue";
export { default as PluginToolGroup } from "./components/PluginToolGroup.vue";
export { default as PluginTypeDoc } from "./components/PluginTypeDoc.vue";
