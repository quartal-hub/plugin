import type { ElicitationContext, QuartalPluginContext } from "../model/index.ts";

/** The elicitation state of each tool call, keyed by the context object the tool receives. */
const byContext = new WeakMap<object, ElicitationContext>();

/**
 * Registers the elicitation state of one tool call on the context object passed to the tool.
 * @param ctx The context object the tool method receives (a fresh object per call).
 * @param elicitation The call's elicitation state; nothing is registered when absent.
 */
export function bindToolCallElicitation(ctx: QuartalPluginContext, elicitation: ElicitationContext | undefined): void {
  if (elicitation) byContext.set(ctx, elicitation);
}

/**
 * The elicitation state of the tool call that received `ctx`, or `undefined` when the caller
 * cannot elicit.
 * @param ctx The tool method's context parameter.
 */
export function toolCallElicitation(ctx: QuartalPluginContext | undefined): ElicitationContext | undefined {
  return ctx ? byContext.get(ctx) : undefined;
}
