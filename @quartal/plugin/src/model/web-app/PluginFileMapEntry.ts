/**
 * One file in the build-time file map: the `skills/` and `agents/` trees captured by codegen into
 * the artifacts module, so the content routes (skill files, agent files, the zip downloads) can
 * serve without a filesystem. Exactly one of `text` / `base64` is set.
 */
export interface PluginFileMapEntry {
  /** Plugin-root-relative path with forward slashes (e.g. `skills/my-skill/SKILL.md`). */
  path: string;
  /** UTF-8 contents, for text files. */
  text?: string;
  /** Base64-encoded contents, for binary files. */
  base64?: string;
}
