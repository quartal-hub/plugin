import type { HubFileEntry } from "./HubFileEntry.ts";

/**
 * The outcome of a write, as returned by `HubFiles.write()`, `HubFiles.restore()` and
 * `HubFiles.commitUpload()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileWriteResult {
  /** The file after the write. */
  entry: HubFileEntry;
  /** The file did not exist before. */
  created: boolean;
  /** The content was identical and nothing was written. */
  unchanged: boolean;
  /** The content was already stored (under another file or version) and was reused. */
  deduped: boolean;
}
