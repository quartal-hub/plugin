/**
 * The avatar of a company in the Quartal directory: a colour, initials and a picture.
 * @experimental Part of the experimental Quartal Hub services; the shape may change.
 */
export interface HubCompanyAvatar {
  /** Background colour (CSS), when known. */
  color: string | null;
  /** Initials to show when there is no picture. */
  initials: string | null;
  /** Picture URL, when known. */
  url: string | null;
}
