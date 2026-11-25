/**
 * `@quartal/plugin/files` — files in and out of tools (MCP files extension,
 * `io.modelcontextprotocol/files`): `McpFile` arguments read with `readMcpFile`, downloads offered
 * with `offerDownload`, and the `FileStaging` a plugin exports from `src/file-staging.ts` to
 * receive uploads.
 * @experimental The files extension is an experimental MCP extension; its wire format may change.
 * @module
 */
export { offerDownload } from "./offerDownload.ts";
export { readMcpFile } from "./readMcpFile.ts";
export { sha256Base64Url } from "./resolveToolCallFiles.ts";
export type {
  FileDownload,
  FileStaging,
  FileStagingCall,
  FileTransferTarget,
  McpFile,
} from "../model/index.ts";
