/**
 * Compact, MCP-friendly company record returned by `searchCompanies`. Contains only
 * the fields an agent typically needs to (a) confirm the right company with the user
 * and (b) prefill a customer/supplier record. Fetch the full record via
 * `findCompanies` or `getCompanyOverview` when more detail is needed.
 *
 * `companyForm` and `mainBusinessLine` are the human-readable descriptions in the
 * requested language; `companyFormCode` keeps the raw YRMU code for filtering or
 * round-trip use by the agent.
 */
export interface CompanySummary {
  /**
   * Business ID in canonical `NNNNNNN-C` form.
   * @example "0116297-6"
   */
  businessId: string;
  /** Current main company name. */
  name: string;
  /**
   * Localized company form description (e.g. "Osakeyhtiö" / "Limited company").
   * Falls back to `companyFormCode` when no description is available.
   */
  companyForm?: string;
  /**
   * Raw YRMU code (e.g. `OY`, `KY`). Useful when the agent needs to filter or
   * re-query by company form.
   */
  companyFormCode?: string;
  /**
   * Date the company was registered.
   * @format date
   */
  registrationDate?: string;
  /**
   * Date the company ceased, if applicable.
   * @format date
   */
  endDate?: string;
  /** True if the company is currently active (no end date, trade register status active). */
  active: boolean;
  /** Street + city of the visit address, if known. */
  address?: string;
  /** Public website URL, if registered. */
  website?: string;
  /** Localized industry / main business line description. */
  mainBusinessLine?: string;
  /** Statistics Finland industry code (TOL) for the main business line. */
  mainBusinessLineCode?: string;
}
