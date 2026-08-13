import { AjaxFetch, Calculator as SalaxyCalculator, CalculatorLogic, Dates, ReportType } from "@salaxy/core";
import type { Calculation, CalculationRowType, Language } from "@salaxy/core";

import { ReportUtils } from "./utils/index.ts";
import type { ReportInput, SimpleCalculatorInput, SimpleSalaryReportInput } from "./model/index.ts";

/**
 * Salary calculator for anonymous calculations.
 * Used for development, AI skills development and testing purposes.
 */
export class Calculator {

  /**
   * Create a simple salary calculation for a set of rows, employment id, period and salary date.
   * @summary Create a simple calculation. 
   * @param input The input parameters. See SimpleCalculatorInput for details.
   * @returns The calculation object with results.
   */
  public async simpleSalary(input: SimpleCalculatorInput): Promise<Calculation> {
    const ajax = new AjaxFetch();
    ajax.useCookie = false;
    const calcInput = CalculatorLogic.getBlank();
    calcInput.worker!.accountId = input.employmentId || "example-default";
    calcInput.info!.workStartDate = input.period?.start || Dates.startEnd(Dates.getToday(), "start-month");
    calcInput.info!.workEndDate = input.period?.end || Dates.startEnd(Dates.getToday(), "end-month");
    calcInput.workflow!.salaryDate = input.salaryDate || Dates.getToday();
    calcInput.rows!.push(...input.rows.map((row) => ({
      rowType: row.rowType as CalculationRowType,
      message: row.message,
      count: row.count,
      price: row.price,
      data: row.data,
    })));
    const calculator = new SalaxyCalculator(ajax);
    try {
      const result = await calculator.recalculate(calcInput);
      return result;
    } catch (error) {
      console.error(error);
      throw new Error(`Failed to recalculate calculation: ${error}`);
    }
  }

  /**
   * Creates a simple salary calculation for a set of rows, employment id, period and salary date,
   * and returns the result as report HTML string (document or fragment).
   * Runs both simpleSalary and getReportDocument / getReportFragment based on the input.type.
   * @summary Simple salary calculation to report
   * @param input The input parameters. See SimpleSalaryReportInput for details.
   * @returns The report HTML string.
   */
  public async simpleSalaryReport(input: SimpleSalaryReportInput): Promise<string> {
    const calculation = await this.simpleSalary(input);
    if (input.type === "fragment") {
      return await this.getReportFragment({
        calculation,
        reportType: input.reportType ?? ReportType.SalarySlip,
        lang: (input.lang || "fi") as "fi" | "sv" | "en",
      });
    }
    return await this.getReportDocument({
      calculation,
      reportType: input.reportType ?? ReportType.SalarySlip,
      lang: (input.lang || "fi") as "fi" | "sv" | "en",
    });
  }

  /**
   * Gets a report document for a given calculation.
   * @summary Get a report document.
   * @param input The input parameters. See ReportInput for details.
   * @returns The report document as HTML string.
   */
  public async getReportDocument(input: ReportInput): Promise<string> {
    return await ReportUtils.generateDocument({
      calc: input.calculation,
      reportType: input.reportType ?? "salarySlip",
      lang: (input.lang || "fi") as Language,
    });
  }

  /**
   * Gets a report fragment for a given calculation: Only the report html part, without html body tags etc.
   * @summary Get a report fragment.
   * @param input The input parameters. See ReportInput for details.
   * @returns The report fragment as HTML string.
   */
  public async getReportFragment(input: ReportInput): Promise<string> {
    return await ReportUtils.generateFragment({
      calc: input.calculation,
      reportType: input.reportType ?? ReportType.SalarySlip,
      lang: (input.lang || "fi") as Language,
    });
  }
}
