import type { HubFileEntry } from "./HubFileEntry.ts";

/**
 * An entry with the text of a small text file, as returned by `HubFiles.getSnapshot()` and
 * `HubFiles.search()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileItem {
  /** The file or folder. */
  entry: HubFileEntry;
  /** The text of a text file no larger than the requested `inlineMax`. */
  text?: string;
}
