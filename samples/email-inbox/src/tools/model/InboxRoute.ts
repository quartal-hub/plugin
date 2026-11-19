import type { NewInboxRoute } from "./NewInboxRoute.ts";

/** Where the inbox delivers matching email: a tool on another (or this) plugin. */
export interface InboxRoute extends NewInboxRoute {
  id: string;
}
