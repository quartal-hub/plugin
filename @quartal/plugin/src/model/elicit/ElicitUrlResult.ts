/**
 * The user's answer to `elicitUrl`. `accept` means the user agreed to open the page — not that they
 * finished there: check the outcome yourself (and ask again when it is not done).
 */
export interface ElicitUrlResult {
  /** `accept` (opened the page), `decline` or `cancel`. */
  action: "accept" | "decline" | "cancel";
}
