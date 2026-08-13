import type { Period } from "./Period.ts";
import type { SimplifiedRow } from "./SimplifiedRow.ts";

/**
 * Simple input for a calculator.
 * This is a simplified version of the SalaryCalculationInput in Salaxy API:
 * Contains the typically needed fields and only the fields that are useful in anonymous calculations.
 */
export interface SimpleCalculatorInput {
  /**
   * The employment id.
   * In thesting, use typically "example-default". Use "example-17" for underage workers and "example-pensioner" for pensioners.
   * Empty defaults to "example-default".
   * @example "example-default"
   */
  employmentId?: string;
  /**
   * The salary date is the date when the employee receives the salary on their back account.
   * Empty defaults to today.
   * @format date
   */
  salaryDate?: string;
  /**
   * The work period from which the salary is paid.
   * Empty defaults to today's month.
   * @example
   * {
   *   start: "2026-01-01",
   *   end: "2026-01-31"
   * }
   */
  period?: Period;
  /**
   * The rows that make up the calculation.
   * @example
   * [
   * {
   *   "rowType": "hourlySalary",
   *   "price": 15.50,
   *   "count": 40
   * },
   * {
   *   "rowType": "phoneBenefit",
   *   "price": 20,
   *   "count": 1
   * }
   * ]
   */
  rows: SimplifiedRow[];
}
