import type { Annotations } from "./Annotations.ts";

/** Text provided to or from an LLM. */
export interface TextContent {
  type: "text";
  /** The text content of the message. */
  text: string;
  /** Optional annotations for the client. */
  annotations?: Annotations;
  /** Reserved by the protocol for metadata. */
  _meta?: Record<string, unknown>;
}
