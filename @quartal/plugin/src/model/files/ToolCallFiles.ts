import type { FileDownload } from "./FileDownload.ts";

/**
 * The files of one tool call: the bytes of every received `McpFile` argument by file id, and the
 * downloads the tool offers. Carried from the MCP / REST handler to `readMcpFile` / `offerDownload`.
 */
export interface ToolCallFiles {
  /** Bytes of the received files, by `McpFile.id`. */
  bytes: Map<string, Uint8Array>;
  /** Downloads offered by the tool. */
  downloads: FileDownload[];
}
