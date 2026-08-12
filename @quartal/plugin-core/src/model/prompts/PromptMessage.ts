/** Role of a prompt message (MCP prompts allow user and assistant messages). */
export type PromptRole = "user" | "assistant";

/** Text content of a prompt message. Other MCP content types (image, audio, resource) may be added later. */
export interface PromptTextContent {
  /** Content discriminator. */
  type: "text";
  /** The text of the message. */
  text: string;
}

/** One message returned by a prompt (MCP `prompts/get` message shape). */
export interface PromptMessage {
  /** Message author role. */
  role: PromptRole;
  /** Message content. */
  content: PromptTextContent;
}
