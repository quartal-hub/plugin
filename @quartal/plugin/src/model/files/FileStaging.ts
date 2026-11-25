import type { FileTransferTarget } from "./FileTransferTarget.ts";
import type { McpFile } from "./McpFile.ts";

/** The tool call a staged upload belongs to. */
export interface FileStagingCall {
  /** The MCP tool name. */
  tool: string;
  /** The HTTP request headers of the call (e.g. `Authorization`, to resolve the user). */
  headers: Record<string, string>;
}

/**
 * Where a plugin receives uploaded files (MCP files extension). A plugin opts in by exporting
 * `fileStaging` from `src/file-staging.ts`. The framework asks for one upload target per file on
 * the first `tools/call`, and reads the staged bytes on the retry, before the tool runs.
 *
 * Targets should write to a staging location that accepts one write of at most the declared size,
 * and staged bytes should be deleted when they are not used within the request-state lifetime
 * (10 minutes).
 */
export interface FileStaging {
  /**
   * Creates an upload target for one file.
   * @param file The file's metadata as the client declared it (no bytes yet).
   * @param call The tool call.
   * @returns The target the client uploads to, and a key to read the bytes back with.
   */
  createUpload(file: McpFile, call: FileStagingCall): Promise<{ target: FileTransferTarget; key: string }>;
  /**
   * Reads the bytes uploaded to a target.
   * @param key The key {@link FileStaging.createUpload} returned.
   * @param call The tool call (the retry).
   * @returns The bytes, or `undefined` when nothing arrived.
   */
  read(key: string, call: FileStagingCall): Promise<Uint8Array | undefined>;
}
