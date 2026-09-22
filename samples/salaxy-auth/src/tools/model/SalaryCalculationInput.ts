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
export interface SalaryCalculationInput {
  /**
   * The salary payment date as YYYY-MM-DD.
   * @format date
   */
  salaryDate: string;

  /**
   * Identifier for the employment relation.
   * This is a guid, in worker / employment relation links,
   * e.g. "0521ee04-381e-49c5-bb70-041f77b5cde2" in "salaxy://employments/details/0521ee04-381e-49c5-bb70-041f77b5cde2".
   */
  employmentId: string;

  /** The working period, for which the salary is paid. */
  period: {
    /**
     * The start date of the period as YYYY-MM-DD.
     * @format date
     */
    start: string;
    /**
     * The end date of the period as YYYY-MM-DD.
     * @format date
     */
    end: string;
  };

  /** The rows to calculate. */
  rows: SimpleCalcRow[];
}
