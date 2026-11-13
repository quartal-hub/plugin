import type { HubFileItem } from "./HubFileItem.ts";

/**
 * A whole drive read at one instant, with the change cursor it matches, as returned by
 * `HubFiles.getSnapshot()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileSnapshot {
  /** The drive. */
  drive: string;
  /** The change cursor the snapshot matches: pass it as `since` to `HubFiles.listChanges()`. */
  cursor: number;
  /** Every entry on the drive. */
  items: HubFileItem[];
}
