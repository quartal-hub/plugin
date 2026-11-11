/** A plugin request that the plugin answered with an error status. */
export class PluginClientError extends Error {
  /**
   * @param path The plugin path or URL that was requested.
   * @param status HTTP status code.
   */
  constructor(public readonly path: string, public readonly status: number) {
    super(`${path}: HTTP ${status}`);
    this.name = "PluginClientError";
  }
}
