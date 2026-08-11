import type { CodeFile, CodeType } from "../model/index.ts";

/** Flat type name → definition from all `CodeFile.types` (later files override).
 * @param files Analyzed code files whose types are indexed.
 */
export function buildTypeIndex(files: CodeFile[]): Map<string, CodeType> {
  const index = new Map<string, CodeType>();
  for (const file of files) {
    for (const t of file.types) {
      index.set(t.name, t);
    }
  }
  return index;
}
