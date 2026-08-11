import type { CodeClass } from "./CodeClass.ts";
import type { CodeType } from "./CodeType.ts";

/**
 * A code file in the plugin.
 */
export interface CodeFile {
  /** Name of the file, with extension. */
  name: string;
  /** Type of file. */
  lang: "ts" | "js" | "json";
  /** Full path from plugin root. */
  path: string;
  /** Contents of the file. */
  content: string;

  /** Classes parsed from the file (classes that have methods). */
  classes: CodeClass[];

  /** Types parsed from the file (interfaces, type aliases, classes without methods). */
  types: CodeType[];
}
