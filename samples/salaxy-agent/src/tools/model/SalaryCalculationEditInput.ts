import type { SimpleCalcRow } from "./SimpleCalcRow.ts";

/**
 * Basic salary calculation input for calculating real-life salary calculations.
 * With this you can calculate a realistic salary, but not a complex one.
 *
 * Here, employmentId, salaryDate and period are required as they are necessary for real calculations.
 *
 * In rows, you would typically add the base salary of "salary" (for fixed), "hourlySalary", "monthlySalary" or "board" for board members.
 * You need to set the price and count for hours etc. Other fields are optional.
 *
 * You would also add any additional rows such as benefits, deductions, etc. using the other row types.
 * Common row types are:
 *
 * - "dailyAllowance" for tax free daily allowance (päiväraha)
 * - "milageOwnCar" for kilometers driven with own car (kilometrikorvaus)
 * - "phoneBenefit", use 20 for price for a monthly phone benefit.
 * - "otherBenefit"
 * - additions: "eveningAddition", "nightimeAddition", "saturdayAddition", "sundayWork", "otherAdditions"
 * - "expences" for expences with receipts.
 */
export interface SalaryCalculationEditInput {
  /**
   * The id of the calculation to edit.
   */
  id: string;

  /** The rows to modify in the calculation. */
  rows: SimpleCalcRow[];
}
