import type { MultiplyThese } from "./model/index.ts";

/**
 * A class that calculates things.
 */
export class Calculator {
  /**
   * Add two numbers. This example uses inline / anonymous types.
   * @param input - The parameters.
   * @returns The sum of the two numbers.
   */
  static add(input: {
    /** The first number to add */
    first: number;
    /** The second number to add */
    second: number;
  }): number {
    return input.first + input.second;
  }

  /**
   * Multiply two numbers with a custom type. This example uses a named interface for the input.
   *
   * This description is longer with some paragraphs etc.
   *
   * @param input - The parameters.
   * @example
   * ```ts
   * const result = calculator.multiply({ first: 5, second: 3 });
   * console.log(result); // 15
   * ```
   * @returns The product of the two numbers.
   * @visibility app
   */
  multiply(input: MultiplyThese): number {
    return input.first * input.second;
  }
}
