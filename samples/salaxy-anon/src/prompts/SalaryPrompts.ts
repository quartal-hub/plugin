import type { PromptResponse } from "@quartal/plugin";

/**
 * Prompts that guide an AI agent through common Finnish payroll workflows using this plugin's
 * calculator tools.
 */
export class SalaryPrompts {
  /**
   * Builds a prompt that asks the agent to run a simple salary calculation with the plugin's
   * `simpleSalary` tool and explain the result.
   * @summary Calculate and explain a salary.
   * @param input - The prompt arguments.
   * @returns One user message describing the task.
   */
  static calculateSalary(input: {
    /**
     * Gross salary amount in euros, e.g. "3500" this is description.
     * @summary Gross salary title.
     */
    grossSalary: string;
    /** Optional employment period, e.g. "2026-08". */
    period?: string;
  }): string {
    const period = input.period ? ` for the period ${input.period}` : "";
    return `Calculate a Finnish salary with a gross amount of ${input.grossSalary} ${typeof(input.grossSalary)} EUR${period} `
      + `using the simpleSalary tool XX.`;
  }

  /**
   * Builds a conversation that walks through comparing two salary levels.
   * @summary Compare two salary levels.
   * @param input - The prompt arguments.
   * @returns A multi-message prompt response.
   */
  static compareSalaries(input: {
    /** First gross salary in euros. */
    first: string;
    /** Second gross salary in euros. */
    second: string;
  }): PromptResponse {
    return {
      description: `Compare gross salaries of ${input.first} and ${input.second} EUR.`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Run the simpleSalary tool twice, for gross salaries of ${input.first} EUR and ${input.second} EUR.`,
          },
        },
        {
          role: "user",
          content: {
            type: "text",
            text: "Present the results side by side: employer total cost, withholding and net pay. "
              + "Finish with one sentence on how much more the higher salary costs the employer per month.",
          },
        },
      ],
    };
  }
}
