/**
 * An external MCP server an agent may call, in addition to the tools of its own plugin.
 *
 * Only remote streamable-HTTP servers are supported: an agent definition is data that travels
 * between hosts, so it must never ask a host to spawn a local process.
 */
export interface AgentMcpServer {
  /** Server name; namespaces its tools as `mcp__<name>__<tool>`. */
  name: string;
  /** Transport. Only `http` (streamable HTTP) is supported. */
  type: "http";
  /** Server endpoint (must be `https:`, or `http:` on localhost). */
  url: string;
  /** Static headers sent with every request (e.g. an API version). Never put secrets here. */
  headers?: Record<string, string>;
  /** What the server is for, for hosts that show the agent's connections. */
  description?: string;
}
