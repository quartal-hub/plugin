import type { Avatar } from "./Avatar.ts";

/**
 * Defines the generic context for a Quartal Plugin.
 */
export interface QuartalPluginContext {
  /** The user id of the current user. Undefined if not authenticated. */
  uid?: string;

  /** Whether the user is authenticated. */
  authenticated: boolean;

  /** If authenticated, the email of the current user. Undefined if not authenticated. */
  email?: string;

  /** The token of the current user if authenticated and if valid. */
  token?: string;

  /** The visual representation of the user */
  avatar?: Avatar;

  /** Set of organizations with their attributes. */
  orgs?: Record<string, unknown>;
}
