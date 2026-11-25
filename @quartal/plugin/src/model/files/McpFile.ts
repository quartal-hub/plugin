/**
 * A file passed to a tool (MCP files extension, `io.modelcontextprotocol/files`). Use it as the
 * type of a tool input property: the code generator marks the property with `x-mcp-file`, and an
 * MCP client that supports the extension (Claude) transfers the file's bytes directly to the
 * plugin's file staging — never through the model's context. Read the bytes with
 * `readMcpFile(ctx, input.file)` from `@quartal/plugin/files`.
 *
 * JSDoc on the property: `@accept application/pdf, image/*` limits the types, `@maxSize 20MB`
 * the size, and `@requireDigest` makes the client send the SHA-256 (needed by storages that check
 * it on upload).
 */
export interface McpFile {
  /** The file's id within the call (1–128 characters). */
  id: string;
  /** The file name, when known. */
  name?: string;
  /** The MIME type (`application/octet-stream` when unknown). */
  mimeType: string;
  /** Size in bytes. */
  size: number;
  /** SHA-256 of the bytes, base64url without padding. */
  digest?: { algorithm: "sha-256"; value: string };
  /** The bytes as base64, for a small file sent inline instead of uploaded. */
  data?: string;
}
