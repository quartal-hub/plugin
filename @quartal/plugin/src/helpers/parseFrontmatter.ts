import { parse } from "yaml";

/** A markdown file split into its YAML frontmatter and the body that follows it. */
export interface Frontmatter {
  /** Top-level frontmatter keys. Empty when the block is present but blank. */
  fields: Record<string, unknown>;
  /** Everything after the closing `---` fence, untrimmed. */
  body: string;
}

// `m` so the closing fence must start its own line; the block itself may be empty.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)^(?:---|\.\.\.)[^\S\r\n]*(?:\r?\n)?([\s\S]*)$/m;

/**
 * Splits a markdown file into YAML frontmatter and body — the format both Agent Skills
 * (`SKILL.md`) and Claude agents (`agents/<name>.md`) are authored in.
 *
 * Parsing is delegated to `yaml`, so authors get real YAML: block scalars, nested maps, comments,
 * quoting and escaping all behave as written, and a mistake is an error with a line and column
 * rather than a silently wrong value.
 * @param content File contents.
 * @returns The split file, or null when the content has no frontmatter block at all.
 * @throws {Error} When the frontmatter is present but not valid YAML, or is not a mapping.
 */
export function parseFrontmatter(content: string): Frontmatter | null {
  // Strip a UTF-8 BOM: it would otherwise keep the opening fence from matching.
  const match = FRONTMATTER_RE.exec(content.replace(/^﻿/, ""));
  if (!match) return null;

  const parsed = parse(match[1]) as unknown;
  if (parsed === null || parsed === undefined) return { fields: {}, body: match[2] ?? "" };
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("frontmatter must be a mapping of keys to values");
  }
  return { fields: parsed as Record<string, unknown>, body: match[2] ?? "" };
}
