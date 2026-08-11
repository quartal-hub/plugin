import type { CompanySummary } from "./CompanySummary.ts";

/**
 * Result envelope for the simple `searchCompanies` tool.
 */
export interface SearchCompaniesResult {
  /**
   * Detected query mode:
   * - `businessId` — the input parsed as a valid Y-tunnus and was looked up exactly.
   * - `name` — the input was treated as a partial company-name match.
   * - `empty` — the input was blank.
   */
  mode: "businessId" | "name" | "empty";
  /** Total matches PRH reports across all pages (only the first page is returned here). */
  totalResults: number;
  /** Up to 100 summarized matches on the first page, ordered as PRH returned them. */
  companies: CompanySummary[];
}
