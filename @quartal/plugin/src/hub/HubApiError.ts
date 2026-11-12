/**
 * A failed call to a Quartal Hub service: the service answered with a non-2xx status.
 * @experimental Part of the experimental Quartal Hub services.
 */
export class HubApiError extends Error {
  /**
   * @param status HTTP status of the response, e.g. 403 when the user has no access.
   * @param method HTTP method of the request.
   * @param url URL of the request.
   * @param message The error message from the service, or the status text.
   */
  constructor(
    public readonly status: number,
    public readonly method: string,
    public readonly url: string,
    message: string,
  ) {
    super(`${method} ${url} failed (${status}): ${message}`);
    this.name = "HubApiError";
  }
}
