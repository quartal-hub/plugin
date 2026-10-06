import type { QuartalPluginContext } from "@quartal/plugin-core";
import { getSelection, selectCompany as rememberCompany } from "../lib/salaxyContext.ts";
import type { CompanySelection, CurrentUser, SalaxyCompany, SelectCompanyInput } from "./model/index.ts";

function toCurrentUser(ctx: QuartalPluginContext, company?: SalaxyCompany): CurrentUser {
  const avatar = ctx.avatar;
  return {
    displayName: avatar?.displayName ?? ctx.email ?? "Unknown user",
    email: ctx.email,
    avatar: { color: avatar?.color, initials: avatar?.initials, url: avatar?.url },
    company,
  };
}

/**
 * Choosing the company the Salaxy operations run in. The signed-in user may act for several companies
 * (their own and their advisor customers); every other tool works within the selected one.
 */
export class CompanyTools {
  /**
   * Lists the companies the signed-in user may work in and tells which one is selected. Call this first and let the
   * user choose the company when none is selected (a user with a single company needs no selection).
   * @param _input No parameters are needed.
   * @param ctx The context of the signed-in user.
   * @returns The signed-in user, their companies and the selected company.
   */
  async getCompanies(_input: void, ctx: QuartalPluginContext): Promise<CompanySelection> {
    const { companies, selected } = await getSelection(ctx);
    return { user: toCurrentUser(ctx, selected), companies, selectedCompanyId: selected?.companyId };
  }

  /**
   * Selects the company that all other Salaxy tools work in from now on, until another one is selected.
   * @param input The company to select.
   * @param ctx The context of the signed-in user.
   * @returns The signed-in user, their companies and the selected company.
   */
  async selectCompany(input: SelectCompanyInput, ctx: QuartalPluginContext): Promise<CompanySelection> {
    const selected = await rememberCompany(ctx, input.companyId);
    const { companies } = await getSelection(ctx);
    return { user: toCurrentUser(ctx, selected), companies, selectedCompanyId: selected.companyId };
  }

  /**
   * Returns the signed-in user and the selected company, for the user-identity header of the widgets.
   * @param _input No parameters are needed.
   * @param ctx The context of the signed-in user.
   * @returns The signed-in user; `company` is empty while none is selected.
   * @visibility app
   */
  async getCurrentUser(_input: void, ctx: QuartalPluginContext): Promise<CurrentUser> {
    const { selected } = await getSelection(ctx);
    return toCurrentUser(ctx, selected);
  }
}
