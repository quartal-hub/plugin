const TYPE_KEYWORDS = new Set([
  "string",
  "number",
  "boolean",
  "null",
  "undefined",
  "void",
  "any",
  "unknown",
  "never",
  "object",
  "symbol",
  "bigint",
]);

/**
 * The values of a union whose members are all string literals, quoted or unquoted (`fi | sv`), or
 * `null` when any member is a type keyword or not a plain name.
 * @param parts The union's members.
 */
export function parseStringLiteralUnionParts(parts: string[]): string[] | null {
  const values: string[] = [];
  for (const part of parts) {
    if (TYPE_KEYWORDS.has(part)) return null;
    if (/^["'].*["']$/.test(part)) {
      values.push(part.replace(/^["']|["']$/g, ""));
      continue;
    }
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part)) {
      values.push(part);
      continue;
    }
    return null;
  }
  return values.length > 0 ? values : null;
}
