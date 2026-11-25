/**
 * The user's answer to `elicitForm<T>`: the filled-in form, or that they declined (explicitly said
 * no) or cancelled (dismissed the form).
 */
export type ElicitFormResult<T> =
  | { action: "accept"; content: T }
  | { action: "decline" }
  | { action: "cancel" };
