import type { FileDownload } from "./FileDownload.ts";

/**
 * The files of one tool call: the bytes of every received `McpFile` argument by file id (or, for
 * a staging that confirms instead of reading, the staged key), and the downloads the tool offers.
 * Carried from the MCP / REST handler to `readMcpFile` / `stagedFileKey` / `offerDownload`.
 */
export interface ToolCallFiles {
  /** Bytes of the received files, by `McpFile.id`. */
  bytes: Map<string, Uint8Array>;
  /** Staging keys of files the staging confirmed without the framework reading them, by `McpFile.id`. */
  staged?: Map<string, string>;
  /** Downloads offered by the tool. */
  downloads: FileDownload[];
}
