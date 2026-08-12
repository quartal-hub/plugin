import type { PromptResponse } from "@quartal/plugin";

/**
 * Demo prompts for greetings. Each public function is exposed as an MCP prompt: the properties of
 * its single object parameter become the prompt arguments (string-valued on the MCP wire).
 */
export class GreetingPrompts {
  /**
   * Builds a prompt that asks the model to write a friendly greeting.
   * @summary Write a greeting.
   * @param input - The prompt arguments.
   * @returns One user message (a plain string return becomes a single text message).
   */
  static writeGreeting(input: {
    /** Who the greeting is for. */
    name: string;
    /** Tone of the greeting, e.g. "formal" or "playful". */
    tone?: string;
  }): string {
    const tone = input.tone ?? "friendly";
    return `Write a short, ${tone} greeting for ${input.name}. Keep it to two sentences.`;
  }

  /**
   * Builds a multi-message prompt that sets up a role-played conversation about greetings.
   * @summary Plan a greeting conversation.
   * @param input - The prompt arguments.
   * @returns A full prompt response with a messages array.
   */
  static greetingConversation(input: {
    /** The language to greet in. */
    language: string;
  }): PromptResponse {
    return {
      description: `A short exercise for greeting someone in ${input.language}.`,
      messages: [
        {
          role: "user",
          content: { type: "text", text: `Teach me how to greet someone in ${input.language}.` },
        },
        {
          role: "assistant",
          content: { type: "text", text: "Gladly! Let's start with the most common informal greeting." },
        },
        {
          role: "user",
          content: { type: "text", text: "Give me three variants, from casual to formal, with pronunciation hints." },
        },
      ],
    };
  }
}
