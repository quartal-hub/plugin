/** A company as the directory knows it. */
export interface Company {
  /** Directory id of the company. */
  id: string;
  /** Business ID (Y-tunnus), when known. */
  businessId: string | null;
  name: string;
  /** An advisor (accounting firm): has customers and teams. */
  isAccountingFirm: boolean;
}
