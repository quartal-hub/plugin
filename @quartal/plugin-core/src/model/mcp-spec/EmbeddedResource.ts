import type { Annotations } from "./Annotations.ts";
import type { BlobResourceContents, TextResourceContents } from "./ResourceContents.ts";

/**
 * The contents of a resource, embedded into a prompt or tool call result. It is up to the client
 * how best to render embedded resources for the benefit of the LLM and/or the user.
 */
export interface EmbeddedResource {
  type: "resource";
  /** The embedded resource contents (text or binary). */
  resource: TextResourceContents | BlobResourceContents;
  /** Optional annotations for the client. */
  annotations?: Annotations;
  /** Reserved by the protocol for metadata. */
  _meta?: Record<string, unknown>;
}
