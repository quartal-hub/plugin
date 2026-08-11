import type { Calculation } from "@salaxy/core";

/**
 * Input for generating a report.
 */
export interface ReportInput {
  /** The calculation based on which the report is generated. */
  calculation: Calculation;
  /**
   * The type of the report. Default is SalarySlip.
   * @example "salarySlip"
   */
  reportType?: "salarySlip" | "employerReport" | "paymentReport" | "paymentSummaryReport" | "totalsReport";
  /**
   * The language of the report: Either "fi" (default), "sv" or "en".
   * @example "fi"
   */
  lang?: "fi" | "sv" | "en";
}
