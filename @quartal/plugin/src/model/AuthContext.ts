/** Information for fetching the authentication context (used by the MCP execute side-channel). */
export interface AuthContext {
  /**
   * The request headers containing the `Authorization` header. Used to look up the cached,
   * already-verified context (the execute path has no access to Hono's `c.var`).
   */
  headers: Record<string, string>;
}
