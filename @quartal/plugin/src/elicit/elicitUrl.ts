import type { ElicitUrlOptions, ElicitUrlResult, QuartalPluginContext } from "../model/index.ts";
import { InputRequiredSignal } from "./InputRequiredSignal.ts";
import { toolCallElicitation } from "./toolCallElicitation.ts";

/**
 * Asks the user to open a page (MCP URL-mode elicitation) — for anything that must not pass
 * through the agent: signing in to another service, entering an API key or a password, paying.
 *
 * Like `elicitForm` the call is stateless: the first attempt throws, the client asks the user and
 * calls the tool again, and `elicitUrl` then returns the user's choice. `accept` only means the
 * user agreed to open the page; check the outcome yourself (e.g. "is the secret stored now?") and
 * ask again with a new key when it is not done.
 * @param ctx The tool's context (the second parameter of every tool method).
 * @param key Identifies this question within the tool.
 * @param options The message, the URL, and what to do when the caller cannot open a URL.
 * @returns Whether the user agreed to open the page.
 * @throws When the caller cannot open a URL and `fallback` is `"error"`.
 */
export async function elicitUrl(
  ctx: QuartalPluginContext,
  key: string,
  options: ElicitUrlOptions,
): Promise<ElicitUrlResult> {
  const call = toolCallElicitation(ctx);
  if (!call?.url) {
    if (options.fallback === "error") throw new Error(`${options.message} ${options.url}`);
    return { action: "decline" };
  }
  const response = call.responses[key] as { action?: unknown } | undefined;
  if (response?.action === "accept" || response?.action === "decline" || response?.action === "cancel") {
    return { action: response.action };
  }
  throw new InputRequiredSignal(key, {
    method: "elicitation/create",
    params: { mode: "url", message: options.message, url: options.url },
  });
}
