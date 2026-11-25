import type { QuartalPluginContext } from "@quartal/plugin-core";
import type { FileTransferTarget } from "./FileTransferTarget.ts";
import type { McpFile } from "./McpFile.ts";

/** The tool call a staged upload belongs to. */
export interface FileStagingCall {
  /** The MCP tool name. */
  tool: string;
  /** The tool's arguments (e.g. where the tool will store the file). */
  args: Record<string, unknown>;
  /** The caller's context — the signed-in user in a plugin with authentication. */
  ctx: QuartalPluginContext;
}

/**
 * Where a plugin receives uploaded files (MCP files extension). A plugin opts in by exporting
 * `fileStaging` from `src/file-staging.ts`. The framework asks for one upload target per file on
 * the first `tools/call`, and on the retry checks that the bytes arrived before the tool runs.
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
   * @returns The target the client uploads to, and a key that identifies the staged bytes.
   */
  createUpload(file: McpFile, call: FileStagingCall): Promise<{ target: FileTransferTarget; key: string }>;
  /**
   * Reads the bytes uploaded to a target; the framework then checks size and digest and hands them
   * to the tool (`readMcpFile`).
   * @param key The key {@link FileStaging.createUpload} returned.
   * @param call The tool call (the retry).
   * @returns The bytes, or `undefined` when nothing arrived.
   */
  read?(key: string, call: FileStagingCall): Promise<Uint8Array | undefined>;
  /**
   * Instead of {@link FileStaging.read}: the storage confirms that the bytes arrived with the
   * declared size and digest (e.g. a content-addressed store keyed by the SHA-256), without the
   * framework loading them. The tool then works with the staged key (`stagedFileKey`).
   * @param key The key {@link FileStaging.createUpload} returned.
   * @param file The file's metadata.
   * @param call The tool call (the retry).
   * @returns Whether the bytes arrived and match.
   */
  confirm?(key: string, file: McpFile, call: FileStagingCall): Promise<boolean>;
}
