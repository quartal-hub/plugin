import type { Annotations } from "./Annotations.ts";

/** Audio provided to or from an LLM. */
export interface AudioContent {
  type: "audio";
  /** The base64-encoded audio data. */
  data: string;
  /** The MIME type of the audio. Different providers may support different audio types. */
  mimeType: string;
  /** Optional annotations for the client. */
  annotations?: Annotations;
  /** Reserved by the protocol for metadata. */
  _meta?: Record<string, unknown>;
}
