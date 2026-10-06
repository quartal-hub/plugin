import type { SalaxyCompany } from "./SalaxyCompany.ts";

/** The signed-in user and the company the operations currently run in. */
export interface CurrentUser {
  /** Display name of the signed-in user. */
  displayName: string;
  /** E-mail of the signed-in user. */
  email?: string;
  /** Avatar of the signed-in user. */
  avatar: {
    /** CSS colour of the initials badge. */
    color?: string;
    /** Initials shown when there is no picture. */
    initials?: string;
    /** Picture url. */
    url?: string;
  };
  /** The selected company; undefined while none is selected. */
  company?: SalaxyCompany;
}
