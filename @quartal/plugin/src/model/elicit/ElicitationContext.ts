/**
 * What one tool call can do with elicitation, and the answers it carries. Set by the MCP
 * `tools/call` handler (from the client's capabilities and the retried request's `inputResponses`)
 * and by the REST handler (from the `Qrtl-Elicitation` / `Qrtl-Input-Responses` headers).
 */
export interface ElicitationContext {
  /** The caller can show a form (MCP form-mode elicitation). */
  form: boolean;
  /** The caller can open a URL (MCP URL-mode elicitation). */
  url: boolean;
  /** Answers to earlier input requests, by key (the bare elicitation results). */
  responses: Record<string, unknown>;
  /** Form schemas the code generator built, by `elicitForm` key. */
  schemas: Record<string, Record<string, unknown>>;
}
