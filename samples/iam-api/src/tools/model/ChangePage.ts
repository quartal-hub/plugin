import type { Change } from "./Change.ts";

/** A page of the change feed. */
export interface ChangePage {
  /** The changes, oldest first. */
  items: Change[];
  /** Opaque cursor; pass it back as `since` to continue. */
  cursor: string;
  /** Whether more changes follow the page. */
  more: boolean;
}
