import type { HubFileAuthor } from "./HubFileAuthor.ts";

/**
 * One version in a file's history, as listed by `HubFiles.listVersions()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileVersion {
  /** Id of the version; pass it to `HubFiles.getContent()` to read this version. */
  version: string;
  /** Sequence number of the change. */
  seq: number;
  /** What the change was. */
  op: "create" | "update" | "delete" | "move" | "copy" | "props" | "restore";
  /** Path of the file in this version. */
  path: string;
  /** SHA-256 of the content, lowercase hex. */
  hash?: string;
  /** Size of the content in bytes. */
  size?: number;
  /** MIME type of the content. */
  mimeType?: string;
  /** Who made the change. */
  author: HubFileAuthor;
  /** Message given with the change. */
  message?: string;
  /** When the change was made (ISO 8601). */
  createdAt: string;
  /** Properties of the file in this version. */
  props?: unknown;
}
