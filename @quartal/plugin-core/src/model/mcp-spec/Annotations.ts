import type { Role } from "./Role.ts";

/**
 * Optional annotations for the client. The client can use annotations to inform how objects are
 * used or displayed.
 */
export interface Annotations {
  /** Describes who the intended customer of this object or data is (e.g. `["user", "assistant"]`). */
  audience?: Role[];
  /**
   * Describes how important this data is for operating the server. 1 means "most important"
   * (effectively required); 0 means "least important" (entirely optional).
   */
  priority?: number;
  /** The moment the resource was last modified, as an ISO 8601 formatted string. */
  lastModified?: string;
}
