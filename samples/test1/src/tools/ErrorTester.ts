/**
 * Tools that fail on purpose, for testing MCP error handling end-to-end
 * (server `isError` results, protocol errors from input validation, and widget error display).
 */
export class ErrorTester {
  /**
   * Always throws an Error with the given message — a tool execution error.
   * Per the MCP spec the server reports it inside the result with `isError: true`.
   * @summary Throw a tool execution error.
   * @param input - The parameters.
   * @returns Never returns; always throws.
   */
  static throwError(input: {
    /** The error message to throw. Default: "Deliberate error from ErrorTester.throwError". */
    message?: string;
  }): string {
    throw new Error(input.message ?? "Deliberate error from ErrorTester.throwError");
  }

  /**
   * Throws only when `fail` is true, otherwise echoes the value — for testing the success and
   * error paths of the same tool (e.g. in a widget).
   * @summary Echo a value, or throw when asked to fail.
   * @param input - The parameters.
   * @returns The echoed value.
   */
  static maybeThrow(input: {
    /** When true, the tool throws instead of returning. */
    fail: boolean;
    /** The value to echo back on success. */
    value?: string;
  }): { echoed: string } {
    if (input.fail) {
      throw new Error(`Failed on request (value: ${input.value ?? ""})`);
    }
    return { echoed: input.value ?? "" };
  }

  /**
   * Throws a non-Error value (a plain string), for testing error normalization.
   * @summary Throw a non-Error value.
   * @param input - The parameters.
   * @returns Never returns; always throws.
   */
  static throwString(input: {
    /** The string to throw. Default: "A thrown plain string". */
    message?: string;
  }): string {
    throw input.message ?? "A thrown plain string";
  }
}
