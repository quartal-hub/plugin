/**
 * Full PRH YTJ search input. Mirrors the upstream `/companies` query parameters.
 * All fields are optional; combine them to narrow results. Prefer `searchCompanies`
 * for one-shot agent lookups — this is the "power user" tool.
 */
export interface FindCompaniesInput {
  /**
   * Company name. Matched against current name, previous name, parallel name and
   * auxiliary names by PRH. Partial matches are allowed.
   * @example "Quartal"
   */
  name?: string;
  /**
   * Exact business ID (Y-tunnus). Will be normalized to the `NNNNNNN-C` form.
   * @example "0116297-6"
   */
  businessId?: string;
  /**
   * Town / post office name (case-insensitive partial match).
   * @example "Helsinki"
   */
  location?: string;
  /**
   * Postal code (Finnish 5-digit code).
   * @example "00100"
   */
  postCode?: string;
  /**
   * PRH company form code (YRMU). Common values: `OY` (Osakeyhtiö), `OYJ`, `KY`, `AY`,
   * `OK`, `AOY`, `ASY`, `TYH`. See PRH YRMU code list for full set.
   * @example "OY"
   */
  companyForm?: string;
  /**
   * Statistics Finland industry code (TOL) or industry text. Searches main business line.
   * @example "62010"
   */
  mainBusinessLine?: string;
  /**
   * Earliest company registration date (inclusive).
   * @format date
   * @example "2020-01-01"
   */
  registrationDateStart?: string;
  /**
   * Latest company registration date (inclusive).
   * @format date
   * @example "2024-12-31"
   */
  registrationDateEnd?: string;
  /**
   * Earliest business-ID issue date (inclusive).
   * @format date
   */
  businessIdRegistrationStart?: string;
  /**
   * Latest business-ID issue date (inclusive).
   * @format date
   */
  businessIdRegistrationEnd?: string;
  /**
   * Result page (1-based). Each page is 100 entries. Defaults to page 1.
   * @example 1
   */
  page?: number;
}
