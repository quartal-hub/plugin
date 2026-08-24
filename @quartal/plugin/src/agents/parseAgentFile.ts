import { parseYamlSubset, type YamlValue } from "./parseYamlSubset.ts";

/** An agent file split into its declarative fields and its system prompt. */
export interface ParsedAgentFile {
  /** Frontmatter (markdown) or top-level object (JSON), minus the prompt itself. */
  fields: Record<string, YamlValue>;
  /** System prompt: the markdown body, or the `prompt` property of a JSON agent. */
  prompt: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

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
 */
export function parseAgentFile(source: string, fileName: string): ParsedAgentFile | null {
  return fileName.toLowerCase().endsWith(".json") ? parseJsonAgent(source) : parseMarkdownAgent(source);
}

function parseMarkdownAgent(source: string): ParsedAgentFile | null {
  const match = FRONTMATTER_RE.exec(source.replace(/^﻿/, ""));
  if (!match) return null;
  return { fields: parseYamlSubset(match[1]), prompt: (match[2] ?? "").trim() };
}

function parseJsonAgent(source: string): ParsedAgentFile | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const fields = { ...parsed } as Record<string, YamlValue>;
  let prompt = "";
  for (const key of PROMPT_KEYS) {
    const value = fields[key];
    if (typeof value === "string" && !prompt) prompt = value;
    delete fields[key];
  }
  return { fields, prompt: prompt.trim() };
}
