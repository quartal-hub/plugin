import type { Annotations } from "./Annotations.ts";
import type { BaseMetadata } from "./BaseMetadata.ts";

/** A known resource that the server is capable of reading. */
export interface Resource extends BaseMetadata {
  /** The URI of this resource. */
  uri: string;
  /**
   * A description of what this resource represents. Clients can use this to improve the LLM's
   * understanding of available resources ("hints" to the model).
   */
  description?: string;
  /** The MIME type of this resource, if known. */
  mimeType?: string;
  /** The size of the raw resource content in bytes (before base64 encoding or tokenization), if known. */
  size?: number;
  /** Optional annotations for the client. */
  annotations?: Annotations;
  /** Reserved by the protocol for metadata. */
  _meta?: Record<string, unknown>;
}
