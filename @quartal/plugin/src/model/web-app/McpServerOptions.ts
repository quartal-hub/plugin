/** An external MCP server the plugin declares but does not host: clients connect to `url` directly. */
export interface McpExternalServer {
  /** Absolute URL of the external MCP endpoint (streamable HTTP). */
  url: string;
  /** Extra HTTP headers clients should send (e.g. an API key header). */
  headers?: Record<string, string>;
}

/**
 * One named MCP server of the plugin. Local servers (default) serve a subset of the plugin's own
 * tool classes at `/mcp/<name>`; external servers are only emitted into the generated `mcp.json`
 * so clients connect to the original URL directly (dynamic upstreams, special auth, or converting
 * an existing plugin).
 */
export interface McpServerDefinition {
  /**
   * Tool class names this server exposes (from `src/tools/`). Omitted on a local server = all
   * tool classes. Not allowed together with {@link external}.
   */
  tools?: string[];
  /** Declares this server as external. Mutually exclusive with {@link tools}. */
  external?: McpExternalServer;
  /** What this server exposes (shown in the plugin overview and docs). */
  description?: string;
}

/** Options for the MCP server(s). When not provided, values are read from the plugin manifest. */
export interface McpServerOptions {
  /**
   * MCP server `name` override.
   * Defaults to the last segment of the plugin name (without `@`), e.g. `auth-agent` for `@samples/auth-agent`.
   */
  name?: string;
  /**
   * Named MCP servers. When omitted, the plugin serves one server with every tool at `/mcp`.
   * When set, each local server is mounted at `/mcp/<name>`; the server named `main` is also
   * served at `/mcp`. Names must match `[a-z0-9_-]+`. Prompts are served on `main` (or the first
   * local server); each widget is served by the server that owns its tool.
   */
  servers?: Record<string, McpServerDefinition>;
}
