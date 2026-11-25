import type { McpFile, QuartalPluginContext } from "../model/index.ts";
import { toolCallFiles } from "./toolCallFiles.ts";

/**
 * The staging key of an uploaded `McpFile` argument whose arrival the plugin's file staging
 * confirmed (`FileStaging.confirm`) without the framework reading the bytes — for a tool that moves
 * the staged bytes into place itself instead of reading them.
 * @param ctx The tool's context.
 * @param file The `McpFile` argument.
 * @returns The key `FileStaging.createUpload` returned, or `undefined` for a file the framework read
 * (inline, or a staging with `read`): use `readMcpFile` for those.
 */
export function stagedFileKey(ctx: QuartalPluginContext, file: McpFile): string | undefined {
  return toolCallFiles(ctx)?.staged?.get(file.id);
}
