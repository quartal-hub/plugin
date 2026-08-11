/**
 * Defines a period in time: start and end date.
 * This is compatible with Salaxy type DateRange for the most common use case: only start and end days required, no days count / array.
 */
export interface Period {
  /**
   * The start date
   * @format date
   * @example
   * "2026-01-01"
   */
  start: string;
  /**
   * The end date
   * @format date
   * @example
   * "2026-01-31"
   */
  end: string;
}
