/**
 * What makes a method of a `src/resources/` class an MCP resource: its `@uri` JSDoc tag, plus the
 * optional `@mimeType` and `@cache` tags.
 */
export interface CodeResourceDeclaration {
  /**
   * The resource URI (`policy://travel`), or an RFC 6570 URI template whose `{variables}` are the
   * properties of the method's input object (`policy://expenses/{category}`).
   */
  uri: string;
  /**
   * MIME type of the content: `@mimeType`, else inferred from the return type (`text/plain` for a
   * string, `application/octet-stream` for bytes, `application/json` for any other value).
   */
  mimeType?: string;
  /** How long clients may cache a read, in milliseconds (`@cache 5m`). */
  cacheTtlMs?: number;
  /** Whether a cached read may be shared between users (`@cache 5m public`); default `private`. */
  cacheScope?: "public" | "private";
}
