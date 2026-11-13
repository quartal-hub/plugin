import type { QuartalPluginContext } from "@quartal/plugin-core";
import { notImplemented } from "./notImplemented.ts";

/**
 * Use of the Salaxy service on behalf of companies in the directory: an access token that lets
 * the caller act as one company there, and the customers of an advisor as the Salaxy service
 * lists them. Companies are matched to Salaxy by their Salaxy account id (IBAN format).
 * @mcp hidden
 */
export class Salaxy {
  /**
   * Creates a Salaxy access token that lets the caller act as the given company in the Salaxy
   * service. The caller must be a direct member of the company, or reach it through a verified
   * mandate; otherwise the call is refused (403). The company must have a Salaxy account id in
   * the directory. The token names the company by its Salaxy account id and the caller by their
   * user id, e-mail and name, and expires after 48 hours.
   * @summary /api/salaxy/createToken
   * @param input The company to act as.
   * @returns The token, who it was issued for, and when it expires.
   */
  static async createToken(
    input: {
      /** Directory id of the company. */
      companyId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<CompanyToken> {
    throw notImplemented("Salaxy.createToken");
  }

  /**
   * The customers of an advisor that the caller works with, by Salaxy account id: the client
   * companies covered by the advisor's teams the caller belongs to. This is the caller's own view
   * even for an admin of the advisor (`Companies.listCustomers` lists every customer of the
   * advisor). Customers without a Salaxy account id are left out; a customer reached through
   * several teams appears once. The caller must be a direct member of
   * the advisor; otherwise the call is refused (403).
   * @summary /api/salaxy/customers
   * @param input The advisor, by its Salaxy account id.
   * @returns The customers.
   */
  static async listCustomerAccounts(
    input: {
      /** Salaxy account id (IBAN format) of the advisor. Spaces and letter case are ignored. */
      salaxyId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ items: SalaxyCustomer[] }> {
    throw notImplemented("Salaxy.listCustomerAccounts");
  }

  /**
   * The customers of an advisor that a given user works with, by Salaxy account id: the same
   * answer `listCustomerAccounts` gives that user, for Salaxy's backend acting with its system
   * credentials. Only a token of Salaxy's backend client (its service account, with the system
   * role) may call; any other caller, including a user, is refused (403). The user is named by
   * their user id in this service: the `credentialId` of a token from `createToken`. An unknown
   * user id is not found (404); a user who is not a direct member of the advisor is refused
   * (403), exactly as `listCustomerAccounts` would refuse them.
   * @summary /api/salaxy/customersForUser
   * @rest GET users/{userId}/customer-accounts
   * @param input The advisor, by its Salaxy account id, and the user.
   * @returns The customers.
   */
  static async listCustomerAccountsForUser(
    input: {
      /** Salaxy account id (IBAN format) of the advisor. Spaces and letter case are ignored. */
      salaxyId: string;
      /** User id of the user (the `credentialId` of a token from `createToken`). */
      userId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ items: SalaxyCustomer[] }> {
    throw notImplemented("Salaxy.listCustomerAccountsForUser");
  }
}

/** A customer of an advisor, as known to the Salaxy service. */
export interface SalaxyCustomer {
  /** Salaxy account id of the customer (IBAN format, no spaces). */
  id: string;
  /** Business ID (Y-tunnus) of the customer, when known. */
  businessId: string | null;
}

/** A Salaxy access token for acting as one company. */
export interface CompanyToken {
  /** The token. Send it to the Salaxy API as `Authorization: Bearer <accessToken>`. */
  accessToken: string;
  /** Salaxy account id of the company the token acts as (IBAN format, no spaces). */
  accountId: string;
  /** Id of the user the token was issued to: the caller's user id (`sub`). */
  credentialId: string;
  /** When the token expires (ISO 8601 timestamp). */
  expiresAt: string;
}
