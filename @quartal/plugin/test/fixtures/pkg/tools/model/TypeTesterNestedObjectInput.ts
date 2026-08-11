/** Nested object in params. */
export interface TypeTesterNestedObjectInput {
  /** Outer id. */
  id: string;
  /** Nested payload. */
  payload: {
    /** Inner name. */
    name: string;
    /** Inner score. */
    score: number;
  };
}
