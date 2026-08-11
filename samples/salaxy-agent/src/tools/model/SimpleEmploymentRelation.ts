/**
 * Simplified representation of an employment relation in payroll.
 * A single worker may have multiple employment relations over time.
 */
export interface SimpleEmploymentRelation {
  /** Unique identifier for the employment relation. GUID, use this for creating calculations for the employment relation etc. */
  id: string;
  /** Salaxy URI of the employment relation: This can be used as a link in the user interface. */
  uri: string;
  /** The name of the worker: "First Last". */
  name: string;
  /** The name of the worker, "Last, First". */
  sortableName: string;
  /** Visual representation of the employment relation. */
  avatar: {
    /** The picture of the employment relation. Often undefined if no picture is set. */
    url?: string;
    /** The initials of the employment relation, use this if no picture is set. */
    initials: string;
    /** The color of the employment relation: Use this if no picture is set. */
    color: string;
  };
  /** The Finnish official personal ID (HETU, henkilötunnus) of the employment relation. */
  personalId: string;
  /** The email of the employment relation. */
  email: string;
  /** The base gross salary of the employment relation, if there is a default monthly or hourly salary set. */
  salary: number;
  /** The pension calculation type of the employment relation. */
  pensionCalculation:
    | "undefined"
    | "employee"
    | "entrepreneur"
    | "farmer"
    | "partialOwner"
    | "athlete"
    | "compensation"
    | "boardRemuneration"
    | "smallEntrepreneur"
    | "smallFarmer"
    | "publicSector";
  /** The type of the employment relation. */
  type:
    | "undefined"
    | "salary"
    | "hourlySalary"
    | "monthlySalary"
    | "compensation"
    | "boardMember"
    | "entrepreneur"
    | "farmer"
    | "employedByStateEmploymentFund"
    | "athlete"
    | "performingArtist"
    | "foreignWorker"
    | "workingAbroad";
  /** The start date of the employment relation. */
  startDate?: string;
  /** The end date of the employment relation. */
  endDate?: string;
  /** Whether the employment relation is a fixed term employment relation. */
  isFixedTerm: boolean;
  /** Whether the employment relation has been terminated: Should have an end date set. */
  isTerminated: boolean;
  /** Whether the employment relation is active. */
  isActive: boolean;
}
