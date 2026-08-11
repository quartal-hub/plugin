/**
 * One registered notice (KREK) entry for a company. PRH groups them under `Company.publicNotices`.
 *
 * Subject codes returned by PRH (`entryCodes`) are opaque short strings (e.g. `NIMP`,
 * `TILTAR`). The wrapper enriches them with `entryDescriptions` so the agent and UI can
 * show human-readable text without round-tripping back to PRH for every notice.
 */
export interface PublicNotice {
  /**
   * When the notice was registered.
   * @format date
   */
  registrationDate?: string;
  /** PRH internal record number (diaarinumero). */
  recordNumber: string;
  /** Notice type code (NRT). */
  typeOfRegistration?: string;
  /** Human-readable description of `typeOfRegistration` in the requested language, if known. */
  typeOfRegistrationDescription?: string;
  /** Subject codes (EC), e.g. `NIMP` for name change. */
  entryCodes?: string[];
  /**
   * Resolved descriptions for each `entryCodes` value, in the same order. Unknown codes
   * fall back to the code itself so the array always has the same length as `entryCodes`.
   */
  entryDescriptions?: string[];
}
