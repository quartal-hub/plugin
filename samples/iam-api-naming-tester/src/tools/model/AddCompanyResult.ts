/** The outcome of adding a company from Salaxy. */
export interface AddCompanyResult {
  /** The company the user signed in as, with its directory id. */
  company: { companyId: string; name: string; businessId: string; isAdvisor: boolean; created: boolean };
  /** For an advisor: how its customers went. */
  customers: { created: number; existing: number; mandatesAdded: number; skipped: number };
  /** The user's links that were new. */
  membership: { company: boolean; team: boolean };
}
