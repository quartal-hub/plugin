/** Optional and nullable fields. */
export interface TypeTesterOptionalAndNull {
  /** Required string. */
  required: string;

  /** Optional string. */
  optional?: string;

  /** Explicitly nullable number. */
  nullable: number | null;

  /** May be optional or null. */
  nullish?: boolean | null;
}
