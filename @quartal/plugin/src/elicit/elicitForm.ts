import type { ElicitFormOptions, ElicitFormResult, QuartalPluginContext } from "../model/index.ts";
import { InputRequiredSignal } from "./InputRequiredSignal.ts";
import { toolCallElicitation } from "./toolCallElicitation.ts";
import { validateFormContent } from "./validateFormContent.ts";

/**
 * Asks the user to fill in a form (MCP form-mode elicitation) and returns the answer.
 *
 * The call is stateless: when the answer is not in the request yet, `elicitForm` throws, the client
 * shows the form and **calls the tool again** with the answer — the method runs again from the
 * start and `elicitForm` then returns it. So ask first and change things after: code before
 * `elicitForm` runs once per attempt.
 *
 * The form comes from `T`: a flat object of strings, numbers, booleans, string-literal unions
 * (single choice) and arrays of one (multiple choice); each property's JSDoc becomes the field
 * label. The code generator builds the schema when `key` is a string literal; otherwise pass
 * `options.schema`. Never ask for passwords, API keys or payment details in a form — use
 * `elicitUrl`.
 * @param ctx The tool's context (the second parameter of every tool method).
 * @param key Identifies this question within the tool (a string literal).
 * @param options The message, and what to do when the caller cannot show a form.
 * @returns The filled-in form, or that the user declined or cancelled.
 * @throws When the caller cannot show a form and `fallback` is `"error"`.
 * @example
 * ```ts
 * const answer = await elicitForm<PaymentConfirmation>(ctx, "confirm", { message: `Pay ${total} €?` });
 * if (answer.action !== "accept") return { status: "cancelled" };
 * ```
 */
export async function elicitForm<T extends object>(
  ctx: QuartalPluginContext,
  key: string,
  options: ElicitFormOptions,
): Promise<ElicitFormResult<T>> {
  const call = toolCallElicitation(ctx);
  const schema = options.schema ?? call?.schemas[key];
  if (!call?.form) {
    if (options.fallback === "error") throw new Error(options.message);
    return { action: "decline" };
  }
  if (!schema) {
    throw new Error(
      `elicitForm("${key}"): no form schema. Call elicitForm<T> with a type argument and a string-literal key, or pass options.schema.`,
    );
  }

  const response = call.responses[key] as { action?: unknown; content?: unknown } | undefined;
  if (response?.action === "decline" || response?.action === "cancel") return { action: response.action };
  if (response?.action === "accept" && validateFormContent(schema, response.content)) {
    return { action: "accept", content: response.content as T };
  }
  // No answer yet, or an answer that does not match the form: ask (again).
  throw new InputRequiredSignal(key, {
    method: "elicitation/create",
    params: { mode: "form", message: options.message, requestedSchema: schema },
  });
}
