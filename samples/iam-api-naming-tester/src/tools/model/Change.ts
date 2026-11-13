/** One changed directory row in the change feed. */
export interface Change {
  /** The kind of row: a person, a company, a team, a membership (`company_member`, `team_member`), a mandate (`team_company`) or a signing authority. */
  kind:
    | "person"
    | "company"
    | "team"
    | "company_member"
    | "team_member"
    | "team_company"
    | "signing_authority";
  /** Always `upsert`: replace the row of the same kind and id. */
  op: "upsert";
  /** The row's columns. Relations carry `valid_from` and `valid_to` (YYYY-MM-DD; `valid_to` null while open). */
  data: { [key: string]: unknown };
}
