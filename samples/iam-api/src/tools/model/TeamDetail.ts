import type { Team } from "./Team.ts";

/** A team with its current members and mandates. */
export interface TeamDetail extends Team {
  /** Current members: the membership id, the person and the first day of the membership. */
  members: { id: string; personId: string; name: string; email: string | null; validFrom: string }[];
  /** Current mandates: the mandate id, the client company and the first day of the mandate. */
  companies: {
    id: string;
    companyId: string;
    companyName: string;
    businessId: string | null;
    validFrom: string;
  }[];
}
