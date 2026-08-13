import type { Resource } from "./Resource.ts";

/**
 * A resource that the server is capable of reading, included in a prompt or tool call result.
 * Note: resource links returned by tools are not guaranteed to appear in `resources/list`.
 */
export interface ResourceLink extends Resource {
  type: "resource_link";
}
