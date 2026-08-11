import type { DateRange, RowAccounting } from "@salaxy/core";

/**
 * Row type enumeration as union type.
 * TODO: In the latest version of @salaxy/core (as of writing in Beta) this is already a union type. Remove this once the latest version is released.
 */
export type RowType =
  | "unknown"
  | "salary"
  | "hourlySalary"
  | "monthlySalary"
  | "totalWorkerPayment"
  | "totalEmployerPayment"
  | "timeRatePay"
  | "compensation"
  | "overtime"
  | "tesWorktimeShortening"
  | "eveningAddition"
  | "nightimeAddition"
  | "saturdayAddition"
  | "sundayWork"
  | "otherAdditions"
  | "paidSickLeaveSalary"
  | "paidSickLeaveHourlySalary"
  | "paidSickLeaveMonthlySalary"
  | "trainingSalary"
  | "trainingHourlySalary"
  | "trainingMonthlySalary"
  | "accomodationBenefit"
  | "mealBenefit"
  | "phoneBenefit"
  | "carBenefit"
  | "bicycleBenefit"
  | "otherBenefit"
  | "holidayCompensation"
  | "holidayBonus"
  | "holidaySalary"
  | "dailyAllowance"
  | "dailyAllowanceHalf"
  | "mealCompensation"
  | "milageOwnCar"
  | "toolCompensation"
  | "expenses"
  | "milageDaily"
  | "milageOther"
  | "unionPayment"
  | "foreclosure"
  | "advance"
  | "foreclosureByPalkkaus"
  | "prepaidExpenses"
  | "otherDeductions"
  | "deductibleOfExerciseAndCultureBenefit"
  | "childCareSubsidy"
  | "chainsawReduction"
  | "nonProfitOrg"
  | "subsidisedCommute"
  | "irIncomeType"
  | "board"
  | "remuneration"
  | "otherCompensation"
  | "workingTimeCompensation"
  | "employmentTermination"
  | "hourlySalaryWithWorkingTimeCompensation"
  | "paidSickLeave"
  | "training"
  | "payStats"
  | "taxAtSource"
  | "taxWithholding"
  | "absencePeriod"
  | "serviceCharge"
  | "service"
  | "script"
  | "totals";

/**
 * Row in a salary calculation.
 * This is a simplified version of the UserDefinedRow in Salaxy API:
 * Contains the typically needed fields and only the fields that are useful in anonymous calculations.
 */
export interface SimplifiedRow {
  /** Logical type of the row. See enumeration for possible values. */
  rowType: RowType;
  /**
   * Description text of the row that is shown in reports.
   * Typically, leave this undefined to get the language versioned text from the row type.
   * Add text only if you need to override the default text.
   */
  message?: string;
  /** Count for the row - default is one */
  count?: number;
  /** Price for the row */
  price: number;
  /**
   * Accounting related data for the row.
   * Set the object only if you need to add dimensions data, specify VAT for expenses etc. or override the accounts (credit / debit account numbers).
   */
  accounting?: RowAccounting | undefined;
  /**
   * Period if different than the Period of calculation. Typically, leave this undefined to use the period of the calculation.
   * Will be reported to the National Incomes registry, but also affect some other calculations, e.g. absences.
   */
  period?: DateRange;

  /**
   * Usecase specific data
   * This is a free-form object that is required for some row types. See documentation or skills for details.
   * The contents depends on the usecase.
   */
  data?: { [key: string]: any };
}
