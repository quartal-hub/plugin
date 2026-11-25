/** Options of `elicitUrl`. */
export interface ElicitUrlOptions {
  /** Why the user should open the page. */
  message: string;
  /**
   * The page to open (HTTPS). It must not contain personal data or credentials, and the page must
   * check that the person opening it is the user of this tool call.
   */
  url: string;
  /** What happens when the caller cannot open a URL: see {@link ElicitFormOptions.fallback}. */
  fallback?: "decline" | "error";
}
