/** A company the caller is a direct member of, with their role there. */
export interface FirmMembership {
  /** Directory id of the company. */
  companyId: string;
  name: string;
  /** Business ID (Y-tunnus), when known. */
  businessId: string | null;
  /** An advisor (accounting firm): has customers and teams. */
  isAccountingFirm: boolean;
  /** The caller's role in the company: `admin` or `member`. */
  role: string;
  /** Id of the membership. */
  membershipId: string;
  /** First day of the membership (YYYY-MM-DD). */
  validFrom: string;
}
