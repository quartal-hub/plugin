/**
 * Execution-side descriptor of one MCP resource or resource template: a method of a class exported
 * from the plugin's `src/resources/mod.ts`, with the `@uri` it is served at. Root object of
 * `mcp-resources.json` is {@link McpResourcesDocument}.
 */
export interface McpResourceDescriptor {
  /** MCP resource `name` (unique within the plugin). */
  id: string;
  /** Source file (stem, no extension). */
  fileName: string;
  /** Source class. */
  className: string;
  /** Source method. */
  methodName: string;
  /** The resource URI, or a URI template when {@link template} is true. */
  uri: string;
  /** Whether {@link uri} is an RFC 6570 template (has `{variables}`). */
  template: boolean;
  /** MCP `title` from `@summary`. */
  title?: string;
  /** Description from the method's JSDoc. */
  description: string;
  /** MIME type of the content (`@mimeType`). */
  mimeType?: string;
  /** How long clients may cache a read, in milliseconds (`@cache`). */
  cacheTtlMs?: number;
  /** Whether a cached read may be shared between users (`@cache … public`). */
  cacheScope?: "public" | "private";
}

/** Root object for `mcp-resources.json`. */
export interface McpResourcesDocument {
  /** Resource descriptors. */
  resources: McpResourceDescriptor[];
}
