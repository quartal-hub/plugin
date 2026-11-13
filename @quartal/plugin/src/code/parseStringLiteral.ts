// The value of a string literal written by {@link quoteStringLiteral}, or `undefined` when the text is not a string literal
export function parseStringLiteral(typeText: string): string | undefined {
  const t = typeText.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    // JSON.parse instead of slicing off the quotes, because the value must also be unescaped
    return JSON.parse(t) as string;
  }
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
  return undefined;
}

// The values of a union of string literals, or `null` if any member is not a string literal
export function parseStringLiteralUnion(members: string[]): string[] | null {
  const values: string[] = [];
  for (const member of members) {
    const value = parseStringLiteral(member);
    if (value === undefined) return null;
    values.push(value);
  }
  return values.length > 0 ? values : null;
}

// The text of a string literal type, quoted and escaped
export function quoteStringLiteral(value: string): string {
  return JSON.stringify(value);
}
