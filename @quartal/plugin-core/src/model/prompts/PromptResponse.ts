import type { PromptMessage } from "../mcp-spec/PromptMessage.ts";

/**
 * Full response object a prompt function may return (mirrors the MCP `prompts/get` result). A prompt
 * function may alternatively return a plain `string`, which the server wraps as a single `user` text
 * message.
 */
export interface PromptResponse {
  /** Optional description of the rendered prompt. */
  description?: string;
  /** The messages that make up the prompt, in order. */
  messages: PromptMessage[];
}

/** What a prompt function may return: a plain string (one user text message) or a full response. */
export type PromptResult = string | PromptResponse;
