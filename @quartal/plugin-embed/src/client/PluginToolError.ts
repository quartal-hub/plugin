/** A plugin tool call that the plugin answered with an error status. */
export class PluginToolError extends Error {
  /**
   * @param message The plugin's error message (its `{ error }` text) or the HTTP status text.
   * @param status HTTP status code.
   * @param body The parsed error body, when it was JSON.
   */
  constructor(message: string, public readonly status: number, public readonly body?: unknown) {
    super(message);
    this.name = "PluginToolError";
  }
}
