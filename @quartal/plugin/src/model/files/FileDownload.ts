import type { FileTransferTarget } from "./FileTransferTarget.ts";

/**
 * A file a tool offers to the user for download (MCP files extension): the client fetches it from
 * the target with `GET` and checks size and digest. Offer it with `offerDownload(ctx, …)` and also
 * describe it in the tool's result.
 */
export interface FileDownload extends Omit<FileTransferTarget, "method" | "form"> {
  /** The file name shown to the user. */
  name?: string;
  /** The MIME type. */
  mimeType: string;
  /** Size in bytes. */
  size: number;
  /** SHA-256 of the bytes, base64url without padding. */
  digest?: { algorithm: "sha-256"; value: string };
}
