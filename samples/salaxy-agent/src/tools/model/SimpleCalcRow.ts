import type { CalculationRowType } from "@salaxy/core";

/**
 * A simple calculation row that can be used to calculate a salary.
 * This is a simplified version of the UserDefinedRow: No accounting, period, source, sourceId, etc.
 */
export interface SimpleCalcRow {
  /** Logical type of the row */
  rowType: CalculationRowType;
  /**
   * Description text of the row that is shown in reports.
   * Typically, you may leave this undefined and the system will set it based on rowType and languaga..
   */
  message?: string | null;
  /** Count for the row. Default is 1. */
  count?: number;
  /** Required price for the row. */
  price: number;
  /**
   * Usecase specific data. The contents depends on the row type.
   * TODO: Need to add a skill for this.
   */
  data?: {
    [key: string]: any;
  } | null;
}
