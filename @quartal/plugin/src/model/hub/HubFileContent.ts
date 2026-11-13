import type { HubFileEntry } from "./HubFileEntry.ts";

/**
 * A file with its content, as returned by `HubFiles.getContent()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileContent {
  /** The file. */
  entry: HubFileEntry;
  /** How `content` is encoded: text as such (`utf8`), anything else as `base64`. */
  encoding: "utf8" | "base64";
  /** The content. */
  content: string;
}
