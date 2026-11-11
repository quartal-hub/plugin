import type { Tool } from "./Tool.ts";

/** The result of a `tools/list` request (also served as `GET /mcp/tools.json`). */
export interface ListToolsResult {
  tools: Tool[];
  /** Like every MCP result, it may carry more fields. */
  [key: string]: unknown;
}
