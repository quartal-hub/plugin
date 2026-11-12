/** A current member of a company. */
export interface CompanyMember {
  /** Id of the membership. */
  membershipId: string;
  /** Directory person id of the member. */
  personId: string;
  /** User id of the member (the `sub` of their tokens); null when the person has no user account. */
  keycloakSub: string | null;
  /** Issuer of the member's user account; null when the person has no user account. */
  issuer: string | null;
  name: string;
  email: string | null;
  /** Kind of the relation, e.g. `staff`. */
  relationType: string;
  /** The member's role in the company: `admin` or `member`. */
  role: string;
  /** First day of the membership (YYYY-MM-DD). */
  validFrom: string;
}
