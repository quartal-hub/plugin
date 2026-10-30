/** A JSON Schema object (the subset tool input schemas use). */
export type JsonSchema = Record<string, unknown>;

const MAX_DEPTH = 6;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function asSchema(value: unknown): JsonSchema | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonSchema) : undefined;
}

function literal(value: unknown): string {
  return JSON.stringify(value);
}

function comment(text: string, pad: string): string {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 1) return `${pad}/** ${lines[0].replace(/\*\//g, "* /")} */\n`;
  return `${pad}/**\n${lines.map((l) => `${pad} * ${l.replace(/\*\//g, "* /")}`).join("\n")}\n${pad} */\n`;
}

function render(schema: JsonSchema | undefined, depth: number): string {
  if (!schema) return "unknown";
  if (depth > MAX_DEPTH) return "unknown";
  if ("const" in schema) return literal(schema.const);
  if (Array.isArray(schema.enum)) return schema.enum.map(literal).join(" | ") || "never";
  if (typeof schema.$ref === "string") return schema.$ref.split("/").pop() || "unknown";
  for (const key of ["anyOf", "oneOf"] as const) {
    const options = schema[key];
    if (Array.isArray(options)) return options.map((o) => render(asSchema(o), depth + 1)).join(" | ") || "unknown";
  }
  const type = schema.type;
  if (Array.isArray(type)) return type.map((t) => render({ ...schema, type: t }, depth)).join(" | ");
  switch (type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array": {
      const item = render(asSchema(schema.items), depth + 1);
      return /^[A-Za-z0-9_$]+$/.test(item) ? `${item}[]` : `Array<${item}>`;
    }
    case "object":
    case undefined: {
      const properties = asSchema(schema.properties);
      if (!properties) {
        const additional = asSchema(schema.additionalProperties);
        if (additional) return `Record<string, ${render(additional, depth + 1)}>`;
        return type === "object" ? "Record<string, unknown>" : "unknown";
      }
      const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
      const pad = "  ".repeat(depth + 1);
      const lines = Object.entries(properties).map(([name, value]) => {
        const prop = asSchema(value);
        const key = IDENTIFIER.test(name) ? name : literal(name);
        const doc = typeof prop?.description === "string" && prop.description ? comment(prop.description, pad) : "";
        return `${doc}${pad}${key}${required.has(name) ? "" : "?"}: ${render(prop, depth + 1)};`;
      });
      return lines.length ? `{\n${lines.join("\n")}\n${"  ".repeat(depth)}}` : "{}";
    }
    default:
      return "unknown";
  }
}

/**
 * Renders a JSON Schema as a TypeScript type expression, with property descriptions as doc
 * comments. Meant for reading (documentation and prompts), not for compiling: unsupported keywords
 * fall back to `unknown`.
 * @param schema The schema.
 */
export function schemaToTypeScript(schema: JsonSchema | undefined): string {
  return render(schema, 0);
}
