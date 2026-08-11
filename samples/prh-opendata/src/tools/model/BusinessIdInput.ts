/**
 * Common input for any tool that operates on a single Finnish company.
 * Accepts any of the common variants — see `formatBusinessIdFi` for the normalization rules.
 */
export interface BusinessIdInput {
  /**
   * Finnish business ID (Y-tunnus). Accepts `0116297-6`, `01162976`, `FI01162976`,
   * or the legacy 7-digit form. Must validate against the official checksum.
   * @example "0116297-6"
   */
  businessId: string;
}
