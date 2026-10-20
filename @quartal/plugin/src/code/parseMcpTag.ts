import type { McpDeclaration } from "../model/index.ts";

/**
 * Parses the text of an `@mcp` JSDoc tag on a tool method or class. The only setting is
 * `hidden`: the method (or every method of the class) is left off the MCP server while its REST
 * operation stays. Anything else is an error.
 * @param text Tag text after `@mcp`.
 * @param where `Class.method` or the class name, used as the error prefix.
 */
export function parseMcpTag(text: string, where: string): McpDeclaration {
  const value = text.trim().toLowerCase();
  if (value === "hidden") return { hidden: true };
  throw new Error(`${where}: @mcp "${text.trim()}" is not understood; the only setting is "@mcp hidden"`);
}
