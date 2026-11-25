/** Options of `elicitForm`. */
export interface ElicitFormOptions {
  /** What the user is asked, shown above the form. */
  message: string;
  /**
   * The form's JSON Schema (`requestedSchema`). Leave it out: the code generator builds it from the
   * type argument of `elicitForm<T>` when the key is a string literal.
   */
  schema?: Record<string, unknown>;
  /**
   * What happens when the caller cannot show a form (a client without form elicitation, a 2025-era
   * MCP client, a REST caller that did not opt in): `"decline"` (default) resolves as if the user
   * declined; `"error"` fails the tool call with the message.
   */
  fallback?: "decline" | "error";
}
