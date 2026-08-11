/** Mixed: primitives, array, and optional in one object. */
export interface TypeTesterMixed {
  /** The title of the mixed object. */
  title: string;
  /** The count of the mixed object. */
  count: number;
  /** The tags of the mixed object. */
  tags: string[];
  /** The meta of the mixed object. */
  meta?: { source: string };
}
