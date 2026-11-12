import type { HubCompanyAvatar } from "./HubCompanyAvatar.ts";

/**
 * A customer company of an Advisory (accounting firm), as listed by `HubCompanies.listCustomers()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubCustomer {
  /** Quartal IAM (directory) id of the customer company. */
  companyId: string;
  /** Display name of the customer. */
  name: string;
  /** Business ID (Y-tunnus), when known. */
  businessId: string | null;
  /** Salaxy account id (IBAN format, no spaces), when known. */
  salaxyAccountId: string | null;
  /** The customer's avatar. */
  avatar: HubCompanyAvatar;
  /** When the company was added to the directory (ISO 8601). */
  createdAt: string;
  /** When the company was last changed in the directory (ISO 8601). */
  updatedAt: string;
}
