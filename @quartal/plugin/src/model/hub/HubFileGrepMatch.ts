import type { HubFileEntry } from "./HubFileEntry.ts";

/**
 * A line of a text file that contains the searched text, as returned by `HubFiles.grep()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileGrepMatch {
  /** The file. */
  entry: HubFileEntry;
  /** Line number. */
  line: number;
  /** Column of the match on the line. */
  column: number;
  /** The matching line. */
  text: string;
}
