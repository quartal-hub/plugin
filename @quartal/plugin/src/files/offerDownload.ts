import type { FileDownload, QuartalPluginContext } from "../model/index.ts";
import { toolCallFiles } from "./toolCallFiles.ts";

/**
 * Offers a file to the user for download (MCP files extension): a client that supports downloads
 * (Claude) fetches it from the target and offers it to the user, outside the model's context.
 * Also describe the file in the tool's result — clients without downloads see only that.
 * @param ctx The tool's context.
 * @param download The file: name, type, size, digest and a self-authorizing URL that stays valid
 * for about an hour and answers `GET` with the bytes (no redirects).
 * @returns Whether the caller can receive downloads.
 */
export function offerDownload(ctx: QuartalPluginContext, download: FileDownload): boolean {
  const files = toolCallFiles(ctx);
  if (!files) return false;
  files.downloads.push(download);
  return true;
}
