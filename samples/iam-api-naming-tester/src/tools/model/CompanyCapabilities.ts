/** What the caller may do in a company. */
export interface CompanyCapabilities {
  /** Add, re-role and end members: a direct admin of the company. */
  members: boolean;
  /** Manage teams: a direct admin of an advisor (accounting firm) company. */
  teams: boolean;
  /** List the customers: a direct member of an advisor company — all of them for an admin, otherwise those its own teams cover. */
  customers: boolean;
  /** Create tokens / open as: a direct member, or through a mandate from a verified source (not one added by hand). */
  tokens: boolean;
  /** TEST ONLY: delete the company from the directory — a direct admin of it; never in production. */
  delete: boolean;
}
