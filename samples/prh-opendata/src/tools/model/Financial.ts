/**
 * One filed digital financial statement period for a single company.
 * PRH groups XBRL filings by `(businessId, financialDate)`.
 */
export interface Financial {
  /** Business ID in canonical `NNNNNNN-C` form. */
  businessId: string;
  /**
   * Last day of the financial period (`yyyy-MM-dd`).
   * @format date
   */
  financialDate: string;
  /**
   * When the statement was registered with PRH.
   * @format date
   */
  registrationDate?: string;
}

/** Result envelope returned by XBRL `/financials` and `/all_financials`. */
export interface FinancialResult {
  /** Total number of matching filings across all pages. */
  totalResults: number;
  /** Filings on the current page. */
  financials: Financial[];
}
