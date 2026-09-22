import type { AccountInIndex, CalculationData, CalculationStatus } from "@salaxy/core";

/**
 * Simplified representation of a calculation.
 * Contains the most important information for listings etc.
 */
export interface SimpleCalculation {
  /** The id */
  id: string;
  /** The URI that can be used as a link in the user interface ("salaxy://calc/details/{id}") */
  uri: string;

  /** Short title */
  title: string;
  /** The creation date */
  createdAt: string;
  /** The last update date */
  updatedAt: string;
  /** The employment id */
  employmentId: string;
  /** The employee data: Name, email, avatar, etc. */
  employee: AccountInIndex;
  /** The status */
  status: CalculationStatus;
  /** The working period */
  period: {
    /** The start date of the period. */
    start?: string;
    /** The end date of the period. */
    end?: string;
  };
  /** The salary payment date */
  salaryDate: string;
  /** The most significant basic data about the type of calculation, different numbers etc. */
  data: CalculationData;
}
