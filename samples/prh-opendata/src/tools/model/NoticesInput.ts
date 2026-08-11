/**
 * Input for `Notices.getCompanyNotices` and `CompanyOverview.getCompanyOverview`.
 * Accepts the same business ID variants as `BusinessIdInput` and lets the caller pick
 * the language used to resolve KREK code descriptions (`entryCodes`, `typeOfRegistration`).
 */
export interface NoticesInput {
  /**
   * Finnish business ID (Y-tunnus). Accepts `0116297-6`, `01162976`, `FI01162976`,
   * or the legacy 7-digit form.
   * @example "0116297-6"
   */
  businessId: string;
  /**
   * Language for resolved code descriptions. Defaults to `"fi"`.
   * @example "fi"
   */
  lang?: "fi" | "sv" | "en";
}
