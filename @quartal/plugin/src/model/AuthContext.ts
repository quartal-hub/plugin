import type { ElicitationContext } from "./elicit/ElicitationContext.ts";

/** Information for fetching the authentication context (used by the MCP execute side-channel). */
export interface AuthContext {
  /**
   * The request headers containing the `Authorization` header. Used to look up the cached,
   * already-verified context (the execute path has no access to Hono's `c.var`).
   */
  headers: Record<string, string>;
  /** Elicitation support and answers of this tool call; absent when the caller cannot elicit. */
  elicitation?: ElicitationContext;
}
