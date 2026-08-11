import type { QuartalPluginContext } from "@quartal/plugin-core";

/**
 * A class that says hello to the world.
 */
export class HelloWorld {
  /**
   * Say hello to the world. If you leave input empty, will use email from session.
   * @param input - The parameters.
   * @param ctx - Authenticated request context.
   * @returns The greeting.
   */
  static sayHello(input: {
    /** The name to say hello to. If not provided, will use the display name from the context. */
    name?: string;
  }, ctx: QuartalPluginContext): string {
    return `Hello, ${input.name || ctx.avatar?.displayName || "No name"}!`;
  }

  /**
   * Function using this to access private method. Also shows email, uid and owner from context.
   * @param input - The parameters.
   * @param ctx - Authenticated request context.
   * @returns The greeting.
   */
  sayHelloWithThis(input: {
    /** The name to say hello to. If not provided, will use the display name from the context. */
    name?: string;
  }, ctx: QuartalPluginContext): string {
    return this.privateSayHello(input.name || ctx.avatar?.displayName || "No name", ctx);
  }

  /**
   * Gets the entire context information.
   * @param _input No parameters needed at the moment.
   * @param ctx Authenticated request context (token is omitted from the response).
   * @returns The context info.
   */
  getSessionInfo(_input: any, ctx: QuartalPluginContext): QuartalPluginContext {
    const { token: _token, ...others } = ctx;
    return others;
  }

  private privateSayHello(name: string, ctx: QuartalPluginContext): string {
    return `Hello with this, ${name}! (${ctx.email}, ${ctx.uid})`;
  }
}
