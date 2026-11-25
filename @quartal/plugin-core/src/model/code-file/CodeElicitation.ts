/**
 * A form a tool method asks the user to fill in with `elicitForm<T>(ctx, key, …)`, found by the
 * code generator: the key and the MCP form schema built from `T`.
 */
export interface CodeElicitation {
  /** The key passed to `elicitForm` (a string literal). */
  key: string;
  /** The MCP elicitation `requestedSchema` built from the type argument. */
  schema: Record<string, unknown>;
}
