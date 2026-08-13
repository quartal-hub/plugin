import type { ContentBlock } from "./ContentBlock.ts";
import type { Role } from "./Role.ts";

/**
 * Describes a message returned as part of a prompt.
 *
 * This is similar to `SamplingMessage`, but also supports the embedding of resources from the MCP
 * server.
 */
export interface PromptMessage {
  /** Message author role. */
  role: Role;
  /** Message content (text, image, audio, resource link or embedded resource). */
  content: ContentBlock;
}
