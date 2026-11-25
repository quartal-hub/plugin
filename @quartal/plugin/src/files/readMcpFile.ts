import type { McpFile, QuartalPluginContext } from "../model/index.ts";
import { base64ToBytes } from "../hub/base64.ts";
import { sha256Base64Url } from "./resolveToolCallFiles.ts";
import { toolCallFiles } from "./toolCallFiles.ts";

/**
 * The bytes of a file passed to the tool as an `McpFile` argument. The framework has already
 * received them (inline or uploaded to the plugin's file staging) and checked their size, type
 * and digest before the tool runs. A tool called directly (outside the MCP and REST handlers, e.g.
 * in a unit test) can still read a file with inline `data`; it is checked the same way.
 * @param ctx The tool's context (the second parameter of every tool method).
 * @param file The `McpFile` argument.
 * @returns The bytes.
 * @throws When the file is not an argument of this call.
 * @example
 * ```ts
 * const pdf = await readMcpFile(ctx, input.statement);
 * ```
 */
export async function readMcpFile(ctx: QuartalPluginContext, file: McpFile): Promise<Uint8Array> {
  const bytes = toolCallFiles(ctx)?.bytes.get(file.id);
  if (bytes) return bytes;
  if (!toolCallFiles(ctx) && typeof file.data === "string") {
    const decoded = base64ToBytes(file.data);
    if (decoded.length !== file.size) throw new Error(`File "${file.name ?? file.id}" is not ${file.size} bytes.`);
    if (file.digest && await sha256Base64Url(decoded) !== file.digest.value) {
      throw new Error(`File "${file.name ?? file.id}" does not match its SHA-256 digest.`);
    }
    return decoded;
  }
  throw new Error(`File "${file.name ?? file.id}" is not an argument of this tool call.`);
}
