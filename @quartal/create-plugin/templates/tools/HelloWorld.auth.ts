import type { QuartalPluginContext } from "@quartal/plugin-core";

/**
 * A sample tool class. Every public method of an exported class becomes an MCP tool and a REST
 * action; the JSDoc comments and TypeScript types become the tool descriptions and schemas.
 * A trailing `QuartalPluginContext` parameter receives the authenticated session.
 */
export class HelloWorld {
  /**
   * Say hello. If no name is given, greets the authenticated user.
   * @param input - The parameters.
   * @param ctx - Authenticated request context.
   * @returns The greeting.
   */
  static sayHello(input: {
    /** The name to say hello to. Defaults to the display name from the session. */
    name?: string;
  }, ctx: QuartalPluginContext): string {
    return `Hello, ${input.name || ctx.avatar?.displayName || "World"}!`;
  }
}
