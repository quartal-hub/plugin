import type { HubFileAuthor } from "./HubFileAuthor.ts";
import type { HubFileEntry } from "./HubFileEntry.ts";

/**
 * One committed change in a company's files, as listed by `HubFiles.listChanges()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileChange {
  /** Sequence number of the change: the cursor after it. */
  seq: number;
  /** What happened to the entry. */
  op: "created" | "changed" | "deleted";
  /** The drive of the entry. */
  drive: string;
  /** Drive-absolute path of the entry. */
  path: string;
  /** Stable id of the entry. */
  id: string;
  /** The entry is a folder. */
  isFolder: boolean;
  /** Application-defined type of the file. */
  type?: string;
  /** The version the change made. */
  version?: string;
  /** Who made the change. */
  author: HubFileAuthor;
  /** When the change was committed (ISO 8601). */
  at: string;
  /** The entry after the change; absent for a deletion. */
  entry?: HubFileEntry;
}
