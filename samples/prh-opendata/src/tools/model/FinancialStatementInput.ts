/**
 * Input for fetching one specific XBRL filing as XML.
 */
export interface FinancialStatementInput {
  /**
   * Business ID (Y-tunnus). Will be normalized to canonical `NNNNNNN-C` form.
   * @example "0116297-6"
   */
  businessId: string;
  /**
   * Last day of the financial period to fetch. Use `getFinancialPeriods` first to
   * see which dates the company has filed.
   * @format date
   * @example "2023-12-31"
   */
  financialDate: string;
}

/** Result envelope wrapping the raw XBRL XML string. */
export interface FinancialStatementResult {
  /** Business ID the filing belongs to (canonical form). */
  businessId: string;
  /**
   * Financial period end date.
   * @format date
   */
  financialDate: string;
  /**
   * Raw XBRL XML payload from PRH. The XBRL taxonomy is documented at
   * https://avoindata.prh.fi/fi/info/swagger-ui.
   */
  xbrlXml: string;
}
