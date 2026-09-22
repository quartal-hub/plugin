import { Calculations, Dates, Employments, OData, Session } from "@salaxy/core";
import type { CalculationResult, ODataQueryOptions, UserSession } from "@salaxy/core";
import type { QuartalPluginContext } from "@quartal/plugin-core";
import { quartalContextToSalaxyContext } from "../lib/salaxyContext.ts";
import type {
  SalaryCalculationEditInput,
  SalaryCalculationInput,
  SimpleCalculation,
  SimpleEmploymentRelation,
  SimpleSalaryCalculationInput,
} from "./model/index.ts";

/**
 * Basic tools for working with Salaxy.
 */
export class SalaxyTools {
  /**
   * Calculates a very simple salary calculation for salary only: No additional rows such as benefits, deductions, etc.
   *
   * @param input - The input parameters.
   * @param ctx - Salaxy session and API client context.
   * @returns The calculation result object. Check totals for universal totals and workerCalc for values from worker point of view including deductions and side costs.
   */
  async calculateDemoSalary(input: SimpleSalaryCalculationInput, ctx: QuartalPluginContext): Promise<CalculationResult> {
    const salaxy = await quartalContextToSalaxyContext(ctx);
    const calculations = new Calculations(salaxy.getAjax());
    const calc = calculations.getBlank();
    calc.employer!.isSelf = true;
    calc.rows!.push({
      type: "salary",
      price: input.salary,
      count: 1,
    });
    const period = input.period ?? {};
    calc.info!.workStartDate = period.start ?? Dates.getToday();
    calc.info!.workEndDate = (period.end || "20000-01-01") < calc.info!.workStartDate ? calc.info!.workStartDate : period.end;
    calc.workflow!.salaryDate = input.salaryDate || Dates.getToday();
    calc.worker!.employmentId = input.employmentId;
    const result = await calculations.recalculate(calc);
    return result.result!;
  }

  /**
   * Creates a salary calculation for a given input. With this you can create a realistic salary calculation, but not a complex one with edge cases.
   *
   * Here, employmentId, salaryDate and period are required as they are necessary for real calculations.
   *
   * In rows, you would typically add the base salary of "salary" (for fixed), "hourlySalary", "monthlySalary" or "board" for board members.
   * You need to set the price and count for hours etc. Other fields are optional.
   *
   * You would also add any additional rows such as benefits, deductions, etc. using the other row types.
   * Common row types are:
   *
   * - "dailyAllowance" for tax free daily allowance (päiväraha)
   * - "milageOwnCar" for kilometers driven with own car (kilometrikorvaus)
   * - "phoneBenefit", use 20 for price for a monthly phone benefit.
   * - "otherBenefit"
   * - additions: "eveningAddition", "nightimeAddition", "saturdayAddition", "sundayWork", "otherAdditions"
   * - "expences" for expences with receipts.
   *
   * @param input The input parameters. See description above.
   * @param ctx Salaxy session and API client context.
   * @returns The calculation result object. Also the id and uri for displaying a link in the user interface.
   * Check totals for universal totals and workerCalc for values from worker point of view including deductions and side costs.
   */
  async createSalaryCalculation(
    input: SalaryCalculationInput,
    ctx: QuartalPluginContext,
  ): Promise<CalculationResult & { id: string; uri: string }> {
    const salaxy = await quartalContextToSalaxyContext(ctx);
    const calculations = new Calculations(salaxy.getAjax());
    const calc = calculations.getBlank();
    calc.employer!.isSelf = true;
    calc.rows = input.rows;
    calc.info!.workStartDate = input.period.start;
    calc.info!.workEndDate = input.period.end;
    calc.workflow!.salaryDate = input.salaryDate;
    calc.worker!.employmentId = input.employmentId;
    const result = await calculations.save(calc);
    return {
      id: result.id!,
      uri: `salaxy://calc/details/${result.id}`,
      ...result.result!,
    };
  }

  /**
   * Edits a salary calculation for a given input. With this you can edit the rows of a salary calculation.
   *
   * You identify the calculation by the calculation id.
   *
   * Then you can provide a list of rows to modify in the calculation.
   * All rows will be replaced with the new rows.
   *
   * In rows, you would typically add the base salary of "salary" (for fixed), "hourlySalary", "monthlySalary" or "board" for board members.
   * You need to set the price and count for hours etc. Other fields are optional.
   *
   * You would also add any additional rows such as benefits, deductions, etc. using the other row types.
   * Common row types are:
   *
   * - "dailyAllowance" for tax free daily allowance (päiväraha)
   * - "milageOwnCar" for kilometers driven with own car (kilometrikorvaus)
   * - "phoneBenefit", use 20 for price for a monthly phone benefit.
   * - "otherBenefit"
   * - additions: "eveningAddition", "nightimeAddition", "saturdayAddition", "sundayWork", "otherAdditions"
   * - "expences" for expences with receipts.
   *
   * @param input The input parameters. See description above.
   * @param ctx Salaxy session and API client context.
   * @returns The calculation result object. Also the id and uri for displaying a link in the user interface.
   * Check totals for universal totals and workerCalc for values from worker point of view including deductions and side costs.
   */
  async editSalaryCalculation(
    input: SalaryCalculationEditInput,
    ctx: QuartalPluginContext,
  ): Promise<CalculationResult & { id: string; uri: string }> {
    const salaxy = await quartalContextToSalaxyContext(ctx);
    const calculations = new Calculations(salaxy.getAjax());
    const calc = await calculations.getSingle(input.id);
    if (!calc) {
      throw new Error(`Calculation ${input.id} not found`);
    }
    calc.rows = input.rows;
    const result = await calculations.save(calc);
    return {
      id: result.id!,
      uri: `salaxy://calc/details/${result.id}`,
      ...result.result!,
    };
  }

  /**
   * Fetches the Salaxy session. Contains the user account (company) and credentials (user) data, but also the most important settings.
   * You can find insurance and pension in the settings.
   * @param _input No parameters are needed.
   * @param ctx The context containing the Salaxy session.
   * @returns The Salaxy session.
   */
  async getSession(_input: void, ctx: QuartalPluginContext): Promise<UserSession> {
    const salaxy = await quartalContextToSalaxyContext(ctx);
    const sessionService = new Session(salaxy.getAjax());
    const session = await sessionService.getSession();
    return session;
  }

  /**
   * Fetches a list of Salary calculations calculations (max 100 items).
   * In the user interface, you can link to these with markdown links [Text here, e.g. name or sum](salaxy://calc/details/{id}) using Salaxy URL scheme.
   * The ownerId and ownerInfo are not included in the result. In the listing "otherPartyInfo" is the worker / employee.
   * @param _input No parameters are needed.
   * @param ctx The context containing the Salaxy session.
   * @returns The Salaxy calculations.
   */
  async getCalculations(_input: void, ctx: QuartalPluginContext): Promise<SimpleCalculation[]> {
    const salaxy = await quartalContextToSalaxyContext(ctx);
    const calculationsService = new Calculations(salaxy.getAjax());
    const calculations = await OData.getAllPages((query: ODataQueryOptions) => calculationsService.getOData(query), {
      $top: 100,
    });
    return calculations.items.map((calculation) => ({
      id: calculation.id!,
      uri: `salaxy://calc/details/${calculation.id}`,
      title: `${calculation.otherPartyInfo!.avatar!.displayName!}: ${calculation.grossSalary!}, ${Dates.format(calculation.salaryDate!)}`,
      createdAt: calculation.createdAt!,
      updatedAt: calculation.updatedAt!,
      employmentId: calculation.otherId!,
      employee: calculation.otherPartyInfo!,
      status: calculation.status!,
      period: {
        start: calculation.data!.workStartDate!,
        end: calculation.data!.workEndDate!,
      },
      salaryDate: calculation.salaryDate!,
      data: calculation.data!,
    }));
  }

  /**
   * Gets all the employment relations for a given company (max 100).
   * @param _input No parameters are needed.
   * @param ctx The context containing the Salaxy session.
   * @returns The employment relations.
   */
  async getEmploymentRelations(_input: void, ctx: QuartalPluginContext): Promise<SimpleEmploymentRelation[]> {
    const salaxy = await quartalContextToSalaxyContext(ctx);
    const employmentRelationsService = new Employments(salaxy.getAjax());
    const employmentRelations = await OData.getAllPages(
      (query: ODataQueryOptions) => employmentRelationsService.getOData(query),
      { $top: 100 },
    );
    return employmentRelations.items.map((employmentRelation) => ({
      id: employmentRelation.id!,
      uri: `salaxy://employments/details/${employmentRelation.id}`,
      name: employmentRelation.otherPartyInfo!.avatar!.displayName!,
      sortableName: employmentRelation.otherPartyInfo!.avatar!.sortableName!,
      avatar: {
        url: employmentRelation.otherPartyInfo!.avatar!.url ?? undefined,
        initials: employmentRelation.otherPartyInfo!.avatar!.initials!,
        color: employmentRelation.otherPartyInfo!.avatar!.color!,
      },
      personalId: employmentRelation.otherPartyInfo!.officialId!,
      email: employmentRelation.otherPartyInfo!.email!,
      salary: employmentRelation.grossSalary!,
      pensionCalculation: employmentRelation.data!.pensionCalculation!,
      type: employmentRelation.data!.type!,
      startDate: employmentRelation.data!.startDate!,
      endDate: employmentRelation.data!.endDate!,
      isFixedTerm: employmentRelation.data!.isFixedTerm!,
      isTerminated: employmentRelation.data!.isTerminated!,
      isActive: employmentRelation.data!.isActive!,
    }));
  }
}
