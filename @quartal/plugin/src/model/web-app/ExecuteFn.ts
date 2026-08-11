import type { AuthContext } from "../AuthContext.ts";

/**
 * Interface for executing a method on a class defined in a Quartal Plugin tool file.
 *
 * @param fileName - The name of the file (without the .ts extension). Letters, numbers, underscores and dashes only.
 * @param className - The name of the class within the file.
 * @param methodName - The name of the method. Tries first as static method, then as instance method.
 * @param input - The parameters for the method.
 * @param authContext Information for fetching the authentication context.
 * @returns The response. Always an object; a non-object result is returned as the `value` property.
 */
export type ExecuteFn = (
  fileName: string,
  className: string,
  methodName: string,
  input: Record<string, unknown>,
  authContext?: AuthContext,
) => Promise<Record<string, unknown>>;
