/** A tool on another plugin that looks able to receive `EmailReceived` events. */
export interface ReceiverCandidate {
  /** The tool's MCP name: use it as `tool` in `addRoute`. */
  tool: string;
  description: string;
  /** Why it was suggested. */
  reason: string;
}
