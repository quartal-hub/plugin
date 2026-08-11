/**
 * Input for demo-friendly listing of companies that have filed XBRL statements.
 *
 * Less than 10 % of Finnish companies file digital statements yet, so this listing is
 * mostly useful for sampling working data during integration tests and demos. Pass
 * `financialDate` to list filers for one period (most useful — `2023-12-31` works in
 * tests), or `registeredDateStart` / `registeredDateEnd` to list filings registered
 * within a date window. With no parameters, defaults to the last 12 months registered.
 */
export interface ListFinancialFilersInput {
  /**
   * Financial period end date (last day of the period).
   * @format date
   * @example "2023-12-31"
   */
  financialDate?: string;
  /**
   * Earliest statement registration date (inclusive). Only effective from 2023-07-01.
   * @format date
   */
  registeredDateStart?: string;
  /**
   * Latest statement registration date (inclusive).
   * @format date
   */
  registeredDateEnd?: string;
  /**
   * Result page (1-based). Each page is 100 entries.
   * @example 1
   */
  page?: number;
}
