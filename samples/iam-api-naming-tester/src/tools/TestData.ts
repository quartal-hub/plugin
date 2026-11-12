import type { QuartalPluginContext } from "@quartal/plugin-core";
import type { AddCompanyResult } from "./model/AddCompanyResult.ts";
import { notImplemented } from "./notImplemented.ts";

/**
 * Manage test data in test environment.
 * TEST SERVERS ONLY: This functionality is not available in production.
 */
export class TestData {

  /**
   * Adds a company to the directory by signing in to Salaxy with the company account's user name and password.
   * The company and, for an advisor, its customers are added when missing
   * The caller becomes an admin of the company and, for an advisor, a member of its "Asiakkaat" team.
   * The password is used for that one sign-in and is never stored.
   * @summary [/api/Companies/addFromSalaxy] Adds a company from Salaxy all customers.
   * @rest POST /api/test-data/add-from-salaxy
   * @param input The Salaxy user name and password of the company account.
   * @returns The company, what happened to its customers, and which of the caller's links are new.
   */
  static async addTestCompanyFromSalaxy(
    input: {
      /** Salaxy user name (e-mail). */
      username: string;
      /** Salaxy password. */
      password: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<AddCompanyResult> {
    throw notImplemented("Companies.createFromSalaxy");
  }

  /**
   * Deletes a company from the directory completely, with its memberships, the mandates over it and the teams it owns.
   * The caller must be a direct admin of the company itself (being an admin of an advisor with a mandate over it is not enough).
   * Deletions are not reported by `Directory.listChanges`.
   * @summary [/api/Companies/deleteCompany] Deletes a company completely from the directory.
   * @rest DELETE /api/test-data/companies/{id}
   * @param input The company.
   * @returns What was deleted along with the company.
   */
  static async delete(
    input: {
      /** Directory id of the company. */
      id: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ members: number; mandates: number; teams: number }> {
    throw notImplemented("Companies.delete");
  }

}