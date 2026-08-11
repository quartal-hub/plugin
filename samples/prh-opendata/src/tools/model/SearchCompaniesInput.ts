/**
 * Simple, MCP-friendly single-field company search. Use this when an agent or chat user
 * has a short, ambiguous string ("Quartal", "0116297-6", "1162976").
 *
 * The implementation auto-detects business IDs and routes them to an exact lookup; anything
 * else is treated as a partial name match against PRH's company name index.
 */
export interface SearchCompaniesInput {
  /**
   * Search string. Either a full Finnish business ID (Y-tunnus) or part of a company name.
   * Names are matched case-insensitively across current name, previous name, parallel name
   * and auxiliary names by PRH.
   * @example "Quartal"
   */
  query: string;
  /**
   * Language for resolved code descriptions (company form, main business line). Defaults to `"fi"`.
   * @example "fi"
   */
  lang?: "fi" | "sv" | "en";
}
