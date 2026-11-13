/** A team of an advisor. */
export interface Team {
  /** Directory id of the team. */
  id: string;
  /** Directory id of the advisor that owns the team. */
  ownerCompanyId: string;
  name: string;
  /** When the team was archived (ISO 8601 timestamp); null while the team is live. */
  archivedAt: string | null;
}
