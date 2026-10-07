/**
 * Who can see and call a tool (MCP Apps `_meta.ui.visibility`):
 * `"model"` — visible to and callable by the AI agent; `"app"` — callable by this plugin's
 * widgets only. Hosts default an absent value to `["model", "app"]`.
 */
export type McpToolVisibility = "model" | "app";

/**
 * Hints about how a tool behaves (MCP `tools/list` `annotations`), set with the `@readOnly`, `@destructive`,
 * `@idempotent` and `@openWorld` JSDoc tags. Hosts use them to decide whether to ask the user before a call:
 * a tool marked read-only can run without an approval prompt.
 */
export interface McpToolAnnotations {
  /** The tool does not change anything (`@readOnly`). */
  readOnlyHint?: boolean;
  /** The tool may delete or overwrite data, as opposed to only adding (`@destructive`). Meaningful when not read-only. */
  destructiveHint?: boolean;
  /** Calling the tool again with the same input has no further effect (`@idempotent`). Meaningful when not read-only. */
  idempotentHint?: boolean;
  /** The tool reaches outside the plugin's own closed world, e.g. the open internet (`@openWorld`). */
  openWorldHint?: boolean;
}

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
  /** Behavior hints from the `@readOnly`, `@destructive`, `@idempotent` and `@openWorld` JSDoc tags, advertised as `annotations`. */
  annotations?: McpToolAnnotations;
}

/** Root object for `mcp-tools.json`. */
export interface McpToolsDocument {
  /** Tool descriptors for MCP execution. */
  tools: McpToolDescriptor[];
}
