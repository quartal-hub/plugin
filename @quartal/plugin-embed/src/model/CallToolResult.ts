/** A content block of an MCP tool result. Widgets read `type: "text"` blocks; other types pass through. */
export interface ContentBlock {
  /** Block type (`text`, `image`, `audio`, `resource`, `resource_link`). */
  type: string;
  /** Text of a `text` block. */
  text?: string;
  /** Other block fields (image data, MIME type, resource, …). */
  [key: string]: unknown;
}

/**
 * The result of an MCP `tools/call` as a widget receives it (`ui/notifications/tool-result` and the
 * answer to the widget's own `tools/call`): the JSON result in `structuredContent` plus its serialized
 * text, or `isError: true` with the error message as text.
 */
export interface CallToolResult {
  /** Unstructured content; a successful Quartal tool carries its JSON result as one text block. */
  content: ContentBlock[];
  /** The tool's JSON result. */
  structuredContent?: Record<string, unknown>;
  /** The tool failed; `content` holds the error message. */
  isError?: boolean;
  /** Protocol metadata. */
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}
