/**
 * Recursive tree node for testing ref-only serialization (no circular references in JSON).
 */
export interface TypeTesterTree {
  /** Node value. */
  value: number;
  /** Child nodes (recursive reference). */
  children: TypeTesterTree[];
}
