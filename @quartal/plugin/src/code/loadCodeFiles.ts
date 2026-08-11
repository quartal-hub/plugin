import type { CodeFile } from "../model/index.ts";
import { getSystemCodeFile } from "./getSystemCodeFile.ts";

/** Loads `CodeFile[]` from tools.json, prepending the system types file when missing.
 * @param parsed Parsed tools.json root object.
 */
export function loadCodeFiles(parsed: { files?: CodeFile[] }): CodeFile[] {
  const files = parsed.files ?? [];
  const hasSystem = files.some((f) => f.path === "__system__.ts" || f.name === "__system__.ts");
  return hasSystem ? files : [getSystemCodeFile(), ...files];
}
