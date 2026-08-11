import type { CodeFile } from "../model/index.ts";

/** One OpenAPI tag — Swagger groups operations under these. */
export interface OpenApiTag {
  /** Tag name, equal to the tool class name. */
  name: string;
  /** Free-text description from the class-level JSDoc. */
  description?: string;
}

/** One OpenAPI tag per tool class (Swagger groups operations by tag).
 * @param codeFiles Analyzed code files containing API tool classes.
 */
export function buildOpenApiTags(codeFiles: CodeFile[]): OpenApiTag[] {
  const tags: OpenApiTag[] = [];
  const seen = new Set<string>();

  for (const file of codeFiles) {
    if (file.path === "__system__.ts") continue;
    for (const cls of file.classes) {
      if (!cls.name || seen.has(cls.name)) continue;
      seen.add(cls.name);
      const description = cls.description?.trim();
      tags.push({
        name: cls.name,
        ...(description ? { description } : {}),
      });
    }
  }

  return tags.sort((a, b) => a.name.localeCompare(b.name));
}
