import type { McpFile, QuartalPluginContext } from "../model/index.ts";
import { toolCallFiles } from "./toolCallFiles.ts";

/**
 * The bytes of a file passed to the tool as an `McpFile` argument. The framework has already
 * received them (inline or uploaded to the plugin's file staging) and checked their size, type
 * and digest before the tool runs.
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
  if (!bytes) throw new Error(`File "${file.name ?? file.id}" is not an argument of this tool call.`);
  return bytes;
}
