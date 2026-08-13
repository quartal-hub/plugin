/** One argument of an MCP prompt (values are always strings on the wire). */
export interface PromptArgument {
  /** Argument name (a property of the prompt function's input object). */
  name: string;
  /** Human-readable display title from JSDoc `@summary`. */
  title?: string;
  /** Argument description from JSDoc. */
  description?: string;
  /** Whether the argument must be provided (input property is non-optional). */
  required?: boolean;
}

/** Execution-side descriptor for a single MCP prompt (one entry per prompt function). */
export interface McpPromptDescriptor {
  /** MCP prompt name advertised in `prompts/list` (sanitized, unique within the plugin). */
  id: string;
  /** Source file (stem, no extension) the prompt function was extracted from. */
  fileName: string;
  /** Source class containing the prompt function. */
  className: string;
  /** Source method name on the class. */
  methodName: string;
  /** MCP `title` — short display name from `@summary` JSDoc. */
  title?: string;
  /** Longer description for the prompt, from the method's JSDoc. */
  description: string;
  /** Arguments accepted by the prompt (properties of the single input object). */
  arguments: PromptArgument[];
}

/** Root object for `mcp-prompts.json`. */
export interface McpPromptsDocument {
  /** Prompt descriptors for MCP `prompts/list` + `prompts/get`. */
  prompts: McpPromptDescriptor[];
}
