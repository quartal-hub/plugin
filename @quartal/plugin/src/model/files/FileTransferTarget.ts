/**
 * Where a client sends (upload) or fetches (download) a file's bytes in the MCP files extension:
 * an absolute HTTPS `url`, or a `path` under the plugin's MCP address. Exactly one of the two.
 */
export interface FileTransferTarget {
  /** Absolute HTTPS URL. */
  url?: string;
  /** Path under the MCP server's address (the request then carries the MCP call's credentials when `credentials` is `include`). */
  path?: string;
  /** Upload method; default `PUT`. Downloads always use `GET`. */
  method?: "PUT" | "POST";
  /** For a multipart `POST`: the form fields, then the file part named `fileField`. */
  form?: { fields: { name: string; value: string }[]; fileField: string };
  /** Headers to send exactly as given (never `Authorization` or `Cookie`). */
  headers?: Record<string, string>;
  /** `omit`: the URL authorizes itself (signed, short-lived); `include`: send the MCP call's credentials (same origin only). */
  credentials: "omit" | "include";
  /** RFC 3339 time after which the target should not be used. */
  expiresAt?: string;
}
