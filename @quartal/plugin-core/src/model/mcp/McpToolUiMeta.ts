import type { McpToolVisibility } from "./McpTool.ts";

/** MCP Apps (SEP-1865) `_meta.ui` of a tool in `tools/list`: its widget and who can call it. */
export interface McpToolUiMeta {
  /** The `ui://` resource of the tool's widget, when it has one. */
  resourceUri?: string;
  /** Who can see and call the tool. Hosts default an absent value to `["model", "app"]`. */
  visibility?: McpToolVisibility[];
}
