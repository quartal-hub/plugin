import type { JsonSchema } from "./schemaToTypeScript.ts";

const MAX_DEPTH = 6;

function asSchema(value: unknown): JsonSchema | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonSchema) : undefined;
}

/**
 * A plausible example value for a schema: its `example`, `examples`, `default`, `const` or first `enum` value
 * when it has one, else a placeholder of the right type, with every object property filled in.
 * @param schema The schema.
 * @param depth Nesting depth (internal).
 */
export function exampleFromSchema(schema: JsonSchema | undefined, depth = 0): unknown {
  if (!schema || depth > MAX_DEPTH) return null;
  if (schema.example !== undefined) return schema.example;
  if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
  if ("default" in schema) return schema.default;
  if ("const" in schema) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  for (const key of ["anyOf", "oneOf"] as const) {
    const options = schema[key];
    if (Array.isArray(options)) {
      const first = options.map(asSchema).find((o) => o && o.type !== "null");
      return exampleFromSchema(first, depth + 1);
    }
  }
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== "null") : schema.type;
  switch (type) {
    case "string":
      if (schema.format === "date") return "2026-01-31";
      if (schema.format === "date-time") return "2026-01-31T12:00:00Z";
      return "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [exampleFromSchema(asSchema(schema.items), depth + 1)];
    case "object":
    case undefined: {
      const properties = asSchema(schema.properties);
      if (!properties) return type === "object" ? {} : null;
      return Object.fromEntries(Object.entries(properties).map(([name, value]) => [name, exampleFromSchema(asSchema(value), depth + 1)]));
    }
    default:
      return null;
  }
}
