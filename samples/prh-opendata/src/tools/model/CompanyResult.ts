import type { Company } from "./Company.ts";

/**
 * Paged result envelope returned by the YTJ `/companies` endpoint.
 */
export interface CompanyResult {
  /** Total number of matching companies across all pages. */
  totalResults: number;
  /** Companies on the current page (PRH paginates at 100 per page). */
  companies: Company[];
}
