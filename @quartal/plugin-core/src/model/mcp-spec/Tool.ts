import type { McpToolAnnotations } from "../mcp/McpTool.ts";
import type { McpToolUiMeta } from "../mcp/McpToolUiMeta.ts";
import type { BaseMetadata } from "./BaseMetadata.ts";

/** A JSON Schema of an object (`properties`, `required`, …), as used for a tool's input and output. */
export interface ToolObjectSchema {
  type: "object";
  [key: string]: unknown;
}

/** Definition for a tool the client can call (an entry of the `tools/list` result). */
export interface Tool extends BaseMetadata {
  /** A human-readable description of the tool ("hints" to the model). */
  description?: string;
  /** A JSON Schema object defining the expected parameters for the tool. */
  inputSchema: ToolObjectSchema;
  /** A JSON Schema object defining the structure of the tool's output in `structuredContent`. */
  outputSchema?: ToolObjectSchema;
  /** Hints about the tool's behavior. */
  annotations?: McpToolAnnotations;
  /** Reserved by the protocol for metadata; this plugin sends the MCP Apps `ui` entry. */
  _meta?: { ui?: McpToolUiMeta; [key: string]: unknown };
}
