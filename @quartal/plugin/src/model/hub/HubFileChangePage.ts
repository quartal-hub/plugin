import type { HubFileChange } from "./HubFileChange.ts";

/**
 * A page of the change feed, as returned by `HubFiles.listChanges()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileChangePage {
  /** The changes after the requested cursor, in commit order. Empty when nothing has changed. */
  changes: HubFileChange[];
  /** The cursor to pass as `since` for the next page. */
  cursor: number;
  /** More changes are waiting: ask again right away. */
  hasMore: boolean;
}
