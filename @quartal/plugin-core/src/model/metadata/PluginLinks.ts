/** Relative URLs to detailed plugin metadata endpoints. */
export interface PluginLinks {
  /** URL path to the OpenAPI document. */
  openApi: string;
  /** URL path to the types catalog (resolve a tool's type names to full definitions). */
  types: string;
  /** URL path to MCP server metadata. */
  mcpServer: string;
  /** URL path to the skills catalog. */
  skillsCatalog: string;
  /** URL path to the plugin readme. */
  readme: string;
  /** URL path to the API docs SPA. */
  api: string;
  /** URL path to the MCP docs SPA. */
  mcp: string;
}
