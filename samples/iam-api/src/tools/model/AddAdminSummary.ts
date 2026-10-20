import type { AddAdminAction } from "./AddAdminAction.ts";

/** The outcome of making a user an admin of a company. */
export interface AddAdminSummary {
  company: { id: string; name: string; businessId: string | null; created: boolean };
  results: { issuer: string; action: AddAdminAction; personId?: string }[];
}
