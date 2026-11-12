import type { HubCustomer } from "./HubCustomer.ts";

/**
 * The customers of an Advisory, as returned by `HubCompanies.listCustomers()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubCustomerList {
  /** The customers, by name. */
  customers: HubCustomer[];
  /** More customers matched than the `limit` allowed. */
  truncated: boolean;
}
