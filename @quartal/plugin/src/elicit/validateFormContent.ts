/**
 * Checks accepted form content against the form's schema (the flat MCP elicitation subset): required
 * fields present, each value of the declared type, enum values from the list. Values come from the
 * client and are untrusted.
 * @param schema The form's `requestedSchema`.
 * @param content The accepted content.
 * @returns Whether the content matches.
 */
export function validateFormContent(schema: Record<string, unknown>, content: unknown): boolean {
  if (!content || typeof content !== "object" || Array.isArray(content)) return false;
  const values = content as Record<string, unknown>;
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  for (const name of (schema.required ?? []) as string[]) {
    if (values[name] === undefined) return false;
  }
  for (const [name, value] of Object.entries(values)) {
    const prop = properties[name];
    if (!prop || !valueMatches(prop, value)) return false;
  }
  return true;
}

function valueMatches(prop: Record<string, unknown>, value: unknown): boolean {
  const enumValues = prop.enum as unknown[] | undefined;
  switch (prop.type) {
    case "string":
      return typeof value === "string" && (!enumValues || enumValues.includes(value));
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array": {
      const items = (prop.items ?? {}) as Record<string, unknown>;
      return Array.isArray(value) && value.every((v) => valueMatches(items, v));
    }
    default:
      return false;
  }
}
