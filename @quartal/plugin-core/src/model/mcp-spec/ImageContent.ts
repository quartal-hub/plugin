import type { Annotations } from "./Annotations.ts";

/** An image provided to or from an LLM. */
export interface ImageContent {
  type: "image";
  /** The base64-encoded image data. */
  data: string;
  /** The MIME type of the image. Different providers may support different image types. */
  mimeType: string;
  /** Optional annotations for the client. */
  annotations?: Annotations;
  /** Reserved by the protocol for metadata. */
  _meta?: Record<string, unknown>;
}
