/** A user of the identity provider found for a company, with their standing in the directory. */
export interface UserHit {
  /** User id (the `sub` of that user's tokens). */
  id: string;
  username: string;
  email?: string;
  /** Display name. */
  name: string;
  /** Whether the user account is enabled. */
  enabled: boolean;
  /** Directory person id of the user, when the directory already knows them. */
  personId: string | null;
  /** Already a current member of the firm. */
  alreadyMember: boolean;
}
