import type { QuartalPluginContext, ToolCallFiles } from "../model/index.ts";

/** The files of each tool call, keyed by the context object the tool receives. */
const byContext = new WeakMap<object, ToolCallFiles>();

/**
 * Registers the files of one tool call on the context object passed to the tool.
 * @param ctx The context object the tool method receives (a fresh object per call).
 * @param files The call's files; nothing is registered when absent.
 */
export function bindToolCallFiles(ctx: QuartalPluginContext, files: ToolCallFiles | undefined): void {
  if (files) byContext.set(ctx, files);
}

/**
 * The files of the tool call that received `ctx`.
 * @param ctx The tool method's context parameter.
 */
export function toolCallFiles(ctx: QuartalPluginContext | undefined): ToolCallFiles | undefined {
  return ctx ? byContext.get(ctx) : undefined;
}
