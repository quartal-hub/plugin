/**
 * What an `@mcp` JSDoc tag on a tool method or class declares. Today only `@mcp hidden`: the
 * method (or every method of the class) is not an MCP tool, while its REST operation stays.
 */
export interface McpDeclaration {
  /** `@mcp hidden`: not listed in `tools/list` and not callable over MCP. */
  hidden?: boolean;
}
