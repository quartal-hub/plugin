/** One file of a skill's manifest in a `skills/list` entry (MCP Skills extension). */
export interface McpSkillResource {
  /** The file's resource URI, read with `resources/read` (e.g. `skill://invoicing/references/vat.md`). */
  uri: string;
  /** `sha256:` followed by the lowercase hex SHA-256 of the file's bytes. */
  digest: string;
  /** File size in bytes. */
  size: number;
}
