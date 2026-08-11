import type { ReportInput } from "./ReportInput.ts";
import type { SimpleCalculatorInput } from "./SimpleCalculatorInput.ts";

/** Input for simpleSalaryReport function. */
export interface SimpleSalaryReportInput extends SimpleCalculatorInput, Omit<ReportInput, "calculation"> {
  /**
   * The type of the report: "document" (default) or "fragment".
   * @example "document"
   */
  type?: "document" | "fragment";
}
