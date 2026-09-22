/** Input for a very simple demo-level salary calculation. */
export interface SimpleSalaryCalculationInput {
  /** The salary to calculate. */
  salary: number;

  /**
   * The salary payment date as YYYY-MM-DD.
   * @format date
   */
  salaryDate?: string;

  /**
   * Identifier for the employment relation.
   * This is a guid, in worker / employment relation links,
   * e.g. "0521ee04-381e-49c5-bb70-041f77b5cde2" in "salaxy://employments/details/0521ee04-381e-49c5-bb70-041f77b5cde2".
   */
  employmentId?: string;

  /** The working period, for which the salary is paid. */
  period?: {
    /**
     * The start date of the period as YYYY-MM-DD.
     * @format date
     */
    start?: string;
    /**
     * The end date of the period as YYYY-MM-DD.
     * @format date
     */
    end?: string;
  };
}
