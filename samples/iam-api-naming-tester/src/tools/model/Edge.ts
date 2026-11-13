/** A relation between two directory rows (a membership or a mandate) with its validity period. */
export interface Edge {
  /** Id of the relation. */
  id: string;
  /** First day the relation is valid (YYYY-MM-DD). */
  validFrom: string;
  /** Last day the relation is valid (YYYY-MM-DD); null while it is open. */
  validTo: string | null;
}
