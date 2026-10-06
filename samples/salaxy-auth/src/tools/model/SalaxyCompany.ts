/** A company the signed-in user may act for in Salaxy. */
export interface SalaxyCompany {
  /** Directory id of the company in the Quartal IAM. Pass it to `selectCompany`. */
  companyId: string;
  /** Company name. */
  name: string;
  /** Business id (Y-tunnus), when known. */
  businessId?: string;
  /** The Salaxy account id (IBAN format) the operations act as. */
  salaxyAccountId: string;
  /** The user's role in the company. */
  role: string;
  /** `direct` for an own membership, `team` for a company reached through an advisor's team (a customer). */
  via: "direct" | "team";
  /** The advisor whose team gives the access, for `via: "team"`. */
  firmName?: string;
  /** Avatar colour (CSS), initials and picture url, when known. */
  avatar: {
    /** CSS colour of the initials badge. */
    color?: string;
    /** Initials shown when there is no picture. */
    initials?: string;
    /** Picture url. */
    url?: string;
  };
}
