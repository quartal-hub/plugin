import type { ContractParty } from "@salaxy/core";
import { ContractPartyLogic } from "@salaxy/core";

/**
 * Test data and operations for employees and employment relations.
 */
export class Employment {
  /**
   * Get sample employees.
   *
   * - Erkki Esimerkki (example-default) a regular employee, 18-52 years old
   * - Laura Lukiolainen (example-17) an underage employee, 17 years old
   * - Tanja Eläkeläinen (example-pensioner) a pensioner, 65-67 years old, tax rate 10%
   *
   * @summary Get sample employees.
   * @returns The sample employees as ContractParty objects.
   */
  public static getEmployees(): ContractParty[] {
    return ContractPartyLogic.getSampleContacts().filter((c) => c.avatar?.entityType == "person");
  }

  /**
   * Get sample companies. Currently only Mallitakomo Oy (example-company) is available.
   * @summary Get sample companies.
   * @returns The sample companies as ContractParty objects.
   */
  public static getCompanies(): ContractParty[] {
    return ContractPartyLogic.getSampleContacts().filter((c) => c.avatar?.entityType == "company");
  }
}
