/** One embedded input request of an MCP `input_required` result (`elicitation/create`). */
export interface ElicitationInputRequest {
  /** Always `elicitation/create`. */
  method: "elicitation/create";
  /** The elicitation parameters (`mode`, `message`, and `requestedSchema` or `url`). */
  params: Record<string, unknown>;
}

/**
 * Thrown by `elicitForm` / `elicitUrl` when the answer is not in the request yet. The MCP handler
 * answers it with `resultType: "input_required"` and the REST handler with HTTP 428; the caller
 * retries the same call with the answer, and the tool method runs again from the start.
 */
export class InputRequiredSignal extends Error {
  /**
   * @param key The input request's key (the `elicitForm` / `elicitUrl` key).
   * @param request The embedded request.
   */
  constructor(
    readonly key: string,
    readonly request: ElicitationInputRequest,
  ) {
    super(`Input required: ${key}`);
    this.name = "InputRequiredSignal";
  }

  /** The `inputRequests` map of the input-required answer. */
  get inputRequests(): Record<string, ElicitationInputRequest> {
    return { [this.key]: this.request };
  }
}
