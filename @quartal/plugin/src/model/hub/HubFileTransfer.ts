/**
 * A short-lived URL to fetch a file's bytes from directly, as returned by
 * `HubFiles.getDownloadUrl()`.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubFileTransfer {
  /** The URL. */
  url: string;
  /** The HTTP method to use. */
  method: "GET" | "PUT";
  /** Headers to send with the request, exactly as given. */
  headers?: Record<string, string> | null;
  /** When the URL stops working (ISO 8601). */
  expiresAt: string;
}
