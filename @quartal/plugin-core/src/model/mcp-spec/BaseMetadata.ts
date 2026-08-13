/** Base interface for metadata with name (identifier) and title (display name) properties. */
export interface BaseMetadata {
  /** Intended for programmatic or logical use; used as a display name fallback when title is absent. */
  name: string;
  /** Intended for UI and end-user contexts — optimized to be human-readable and easily understood. */
  title?: string;
}
