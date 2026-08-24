import { parseFrontmatter } from "../helpers/parseFrontmatter.ts";

/** An agent file split into its declarative fields and its system prompt. */
export interface ParsedAgentFile {
  /** Frontmatter (markdown) or top-level object (JSON), minus the prompt itself. */
  fields: Record<string, unknown>;
  /** System prompt: the markdown body, or the `prompt` property of a JSON agent. */
  prompt: string;
}

/** Keys that carry the system prompt in a JSON agent file. */
const PROMPT_KEYS = ["prompt", "systemPrompt"];

/**
 * Parses one agent file into fields plus system prompt.
 *
 * Markdown files use the Claude agent format — YAML frontmatter between `---` fences followed by
 * the system prompt. JSON files carry the same fields as a plain object with the prompt in
 * `prompt` (or `systemPrompt`), which is handier for generated agents.
 * @param source File contents.
 * @param fileName File name, used to pick the format (`.json` vs. markdown).
 * @returns The parsed file, or null when the content cannot be an agent file at all (no
 * frontmatter block, or JSON that is not an object).
 * @throws {Error} When the frontmatter or JSON is present but malformed; the message carries the
 * parser's line and column.
 */
export function parseAgentFile(source: string, fileName: string): ParsedAgentFile | null {
  return fileName.toLowerCase().endsWith(".json") ? parseJsonAgent(source) : parseMarkdownAgent(source);
}

function parseMarkdownAgent(source: string): ParsedAgentFile | null {
  const parsed = parseFrontmatter(source);
  if (!parsed) return null;
  return { fields: parsed.fields, prompt: parsed.body.trim() };
}

function parseJsonAgent(source: string): ParsedAgentFile | null {
  const parsed: unknown = JSON.parse(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const fields = { ...parsed } as Record<string, unknown>;
  let prompt = "";
  for (const key of PROMPT_KEYS) {
    const value = fields[key];
    if (typeof value === "string" && !prompt) prompt = value;
    delete fields[key];
  }
  return { fields, prompt: prompt.trim() };
}
