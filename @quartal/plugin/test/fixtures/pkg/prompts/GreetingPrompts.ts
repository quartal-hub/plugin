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
   * Builds a prompt asking for greeting variants in a language.
   * @summary Greeting variants.
   * @param input - The prompt arguments.
   * @returns One user message.
   */
  static greetingVariants(input: {
    /** The language to greet in. */
    language: string;
  }): string {
    return `Give me three ways to greet someone in ${input.language}, from casual to formal.`;
  }
}
