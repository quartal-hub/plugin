/** Legal entity type for an {@link Avatar}. */
export type AvatarEntityType = "undefined" | "person" | "company" | "personCreatedByEmployer" | "partner";

/** Type of the {@link Avatar} picture. */
export type AvatarPictureType = "icon" | "uploaded" | "gravatar";

/**
 * Visual representation of an account, profile etc. — mainly the image that should be shown, names and short description.
 *
 * This is a self-contained Quartal type (previously imported from `@salaxy/core`), kept as part of the public
 * {@link QuartalPluginContext} so plugins can render the current user without depending on the Salaxy libraries.
 */
export interface Avatar {
  /** Entity type: person/company. */
  entityType?: AvatarEntityType | undefined;
  /** First name or company name. */
  firstName?: string | undefined;
  /** Last name; for companies this should be null. */
  lastName?: string | undefined;
  /** Display name. For a person this is 'FirstName LastName' (auto-created). */
  displayName?: string | undefined;
  /** Sortable name for ordered lists etc. For a person this is 'LastName, FirstName' (auto-created). */
  sortableName?: string | undefined;
  /** Type of the Avatar picture. */
  pictureType?: AvatarPictureType | undefined;
  /** Color — currently only used by type Icon. */
  color?: string | undefined;
  /** Initials — currently only used by type Icon. */
  initials?: string | undefined;
  /** URL of the picture if specified as picture (null in the case of type Icon). */
  url?: string | undefined;
  /** Short description of the user. May be overridden by a context-specific value by the business logic. */
  description?: string | undefined;
  /** Identifier of the object. */
  id?: string | undefined;
  /** The date when the object was created. */
  createdAt?: string | undefined;
  /** The time when the object was last updated (logical update by user, not technical updates). */
  updatedAt?: string | undefined;
  /** Owner ID for this data. */
  owner?: string | undefined;
  /** Indication that for the currently logged-in account, the data is generally read-only. */
  isReadOnly?: boolean | undefined;
  /** Primary partner information. */
  partner?: string | undefined;
}
