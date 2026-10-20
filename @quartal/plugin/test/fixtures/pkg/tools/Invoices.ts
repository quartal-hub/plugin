/** Invoice fields that a client may set. */
export interface InvoiceFields {
  /** Customer name. */
  customer: string;
  /** Total amount in euros. */
  total: number;
  /** Whether the invoice has been paid. */
  paid?: boolean;
}

/** A stored invoice. */
export interface Invoice extends InvoiceFields {
  /** Invoice id. */
  id: string;
}

/**
 * A CRUD resource that relies on the REST naming convention: no `@rest` tags except where noted.
 */
export class Invoices {
  /** Lists invoices, newest first. */
  list(input: {
    /** Page number, starting from 1. */
    page?: number;
    /** Only invoices in this state. */
    status?: "open" | "paid";
  }): Invoice[] {
    void input;
    return [];
  }

  /** Reads one invoice. */
  get(input: {
    /** Invoice id. */
    id: string;
  }): Invoice {
    return { id: input.id, customer: "", total: 0 };
  }

  /** Creates an invoice. */
  create(input: InvoiceFields): Invoice {
    return { id: "new", ...input };
  }

  /** Replaces the fields of an invoice. */
  update(input: Invoice): Invoice {
    return input;
  }

  /** Deletes an invoice. */
  delete(input: {
    /** Invoice id. */
    id: string;
  }): boolean {
    void input;
    return true;
  }

  /** Approves an invoice: a custom method, so it is POST at its own name. */
  approve(input: {
    /** Invoice id. */
    id: string;
  }): Invoice {
    return { id: input.id, customer: "", total: 0, paid: false };
  }

  /**
   * Lists the invoices archived in a year.
   * @rest GET archive/{year}
   */
  listArchive(input: {
    /** Archive year. */
    year: number;
    /** Only invoices of this customer. */
    customer?: string;
  }): Invoice[] {
    void input;
    return [];
  }
}
