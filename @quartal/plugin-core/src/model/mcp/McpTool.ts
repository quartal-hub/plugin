/**
 * Who can see and call a tool (MCP Apps `_meta.ui.visibility`):
 * `"model"` — visible to and callable by the AI agent; `"app"` — callable by this plugin's
 * widgets only. Hosts default an absent value to `["model", "app"]`.
 */
export type McpToolVisibility = "model" | "app";

/** Execution-side descriptor for a single MCP tool (one entry per class method). */
export interface McpToolDescriptor {
  /** MCP tool name advertised in `tools/list` (sanitized, unique within the plugin). */
  id: string;
  /** Source file (stem, no extension) the tool method was extracted from. */
  fileName: string;
  /** Source class containing the tool method. */
  className: string;
  /** Source method name on the class. */
  methodName: string;
  /** MCP `title` — short display name from `@summary` JSDoc. */
  title?: string;
  /** Longer description for the tool, from the method's JSDoc. */
  description: string;
  /** JSON Schema for the tool's input parameters. */
  inputSchema: Record<string, unknown>;
  /** JSON Schema for the tool's result (always an object — non-object results are wrapped as `{ value }`). */
  outputSchema?: Record<string, unknown>;
  /** Visibility scopes from the `@visibility` JSDoc tag, advertised as `_meta.ui.visibility`. */
  visibility?: McpToolVisibility[];
}

/** Root object for `mcp-tools.json`. */
export interface McpToolsDocument {
  /** Tool descriptors for MCP execution. */
  tools: McpToolDescriptor[];
}
