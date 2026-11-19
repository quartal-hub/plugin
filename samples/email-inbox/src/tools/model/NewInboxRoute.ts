/** A route to add: which email goes to which tool. */
export interface NewInboxRoute {
  /** A name for people, e.g. "Supplier invoices". */
  name: string;
  /** Deliver only email whose sender contains this text (case-insensitive). Empty: any sender. */
  fromContains?: string;
  /** Deliver only email whose subject contains this text (case-insensitive). Empty: any subject. */
  subjectContains?: string;
  /** Base URL of the receiving plugin, e.g. `https://invoices.example.com`. */
  pluginUrl: string;
  /** The receiving tool's MCP name, e.g. `importFromEmail`. */
  tool: string;
}
