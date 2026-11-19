/** An email attachment, already stored in the company's Hub Files. */
export interface EmailAttachment {
  /** Path in Hub Files, e.g. `/data/inbox/2026-11-19/<id>/invoice.pdf`. */
  path: string;
  /** The file name as sent. */
  name: string;
  mimeType: string;
  /** Size in bytes. */
  size: number;
}
