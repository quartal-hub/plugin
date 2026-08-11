/** Read-only MCP catalog entry (tools, resources, prompts, widgets). */
export interface McpCatalogEntry {
  /** Catalog entry identifier (matches the MCP tool/resource name). */
  name: string;
  /** Short display name, typically from `@summary`. */
  title?: string;
  /** Longer description from the JSDoc. */
  description?: string;
}

/** Catalog entry for a tool, including its source class/method for traceability. */
export interface McpCatalogTool extends McpCatalogEntry {
  /** MCP tool id (may differ from method name when names collide). */
  id: string;
  /** Source class containing the tool method. */
  className: string;
  /** Source method name on the class. */
  methodName: string;
}

/** In-memory MCP catalog (tools/resources/prompts/widgets) folded into the plugin overview. */
export interface McpCatalog {
  /** Catalog of tools exposed by this plugin. */
  tools: McpCatalogTool[];
  /** Catalog of MCP resources exposed by this plugin (currently unused). */
  resources: McpCatalogEntry[];
  /** Catalog of MCP prompts exposed by this plugin (currently unused). */
  prompts: McpCatalogEntry[];
  /** Catalog of MCP widgets (UI resources) exposed by this plugin. */
  widgets: McpCatalogEntry[];
}
