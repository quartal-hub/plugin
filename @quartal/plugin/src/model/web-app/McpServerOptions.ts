/** Options for the MCP server. When not provided, values are read from the plugin manifest. */
export interface McpServerOptions {
  /**
   * MCP server `name` override.
   * Defaults to the last segment of the plugin name (without `@`), e.g. `auth-agent` for `@samples/auth-agent`.
   */
  name?: string;
}
