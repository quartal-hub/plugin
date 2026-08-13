import type { CodeArrayType, CodeOrSystemType, CodePropOrParam, CodeType, SystemType } from "../model/index.ts";

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

const SYSTEM_TYPES = new Set<SystemType>([
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
  "array",
  "tuple",
  "map",
  "set",
  "date",
  "regexp",
  "function",
  "symbol",
  "bigint",
]);

function parseStringLiteralUnionParts(parts: string[]): string[] | null {
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

function systemTypeToJsonSchema(t: SystemType): Record<string, unknown> {
  if (t === "string") return { type: "string" };
  if (t === "number") return { type: "number" };
  if (t === "boolean") return { type: "boolean" };
  if (t === "null") return { type: "null" };
  if (t === "undefined" || t === "void") return {};
  if (t === "array") return { type: "array", items: {} };
  if (t === "object") return { type: "object", additionalProperties: true };
  return {};
}

/** Builds a JSON Schema for a CodeType (object/enum) — follows `extends` chains via `typeIndex`.
 * @param ct Type definition to convert.
 * @param typeIndex Flat type index for resolving `extends` references.
 * @param seen Type names already visited while resolving inheritance.
 */
export function codeTypeToJsonSchema(
  ct: CodeType,
  typeIndex: Map<string, CodeType>,
  seen: Set<string>,
): Record<string, unknown> {
  if (ct.enum && ct.enum.length > 0) {
    return { type: "string", enum: ct.enum };
  }

  if (seen.has(ct.name)) {
    return { type: "object", additionalProperties: true };
  }
  seen.add(ct.name);

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  const collect = (c: CodeType): void => {
    for (const baseName of c.extends) {
      const base = typeIndex.get(baseName);
      if (base) collect(base);
    }
    for (const p of c.properties) {
      properties[p.name] = codePropToJsonSchema(p, typeIndex, seen);
      if (!p.optional) required.push(p.name);
    }
  };

  collect(ct);
  const schema: Record<string, unknown> = {
    type: "object",
    properties,
    additionalProperties: false,
  };
  if (required.length) schema.required = Array.from(new Set(required));
  return schema;
}

/** Builds a JSON Schema for either a system type, a named CodeType, an inline array, or a union.
 * @param t Type reference or inline type literal to convert.
 * @param typeIndex Flat type index for resolving named types.
 * @param seen Type names already visited while resolving inheritance.
 */
export function codeOrSystemTypeToJsonSchema(
  t: CodeOrSystemType,
  typeIndex: Map<string, CodeType>,
  seen: Set<string>,
): Record<string, unknown> {
  if (typeof t === "string") {
    const trimmed = t.trim();

    if (trimmed.includes(" | ")) {
      const parts = trimmed.split("|").map((p) => p.trim()).filter(Boolean);
      const enumVals = parseStringLiteralUnionParts(parts);
      if (enumVals) return { type: "string", enum: enumVals };
      return {
        oneOf: parts.map((p) => codeOrSystemTypeToJsonSchema(p, typeIndex, seen)),
      };
    }

    if (SYSTEM_TYPES.has(trimmed as SystemType)) {
      return systemTypeToJsonSchema(trimmed as SystemType);
    }

    const named = typeIndex.get(trimmed);
    if (named) return codeTypeToJsonSchema(named, typeIndex, seen);
    return {};
  }

  if (typeof t === "object" && t !== null) {
    if ("items" in t) {
      const arr = t as CodeArrayType;
      return { type: "array", items: codeOrSystemTypeToJsonSchema(arr.items, typeIndex, seen) };
    }
    if ("name" in t && "properties" in t) {
      return codeTypeToJsonSchema(t as CodeType, typeIndex, seen);
    }
  }
  return {};
}

/** Builds a JSON Schema for a single property/parameter, copying JSDoc-derived metadata.
 * @param p Property or parameter definition to convert.
 * @param typeIndex Flat type index for resolving named types.
 * @param seen Type names already visited while resolving inheritance.
 */
export function codePropToJsonSchema(
  p: CodePropOrParam,
  typeIndex: Map<string, CodeType>,
  seen: Set<string>,
): Record<string, unknown> {
  const schema = codeOrSystemTypeToJsonSchema(p.type, typeIndex, seen);
  if (p.summary) (schema as Record<string, unknown>).title = p.summary;
  if (p.description) (schema as Record<string, unknown>).description = p.description;
  if (p.format && (schema as { type?: unknown }).type === "string") {
    (schema as Record<string, unknown>).format = p.format;
  }
  if (p.example !== undefined) {
    (schema as Record<string, unknown>).example = p.example;
  }
  return schema;
}

/** MCP / tool input schema for a function's parameters (unwraps single object param).
 * @param params Function parameters to convert.
 * @param typeIndex Flat type index for resolving named types.
 */
export function buildToolInputSchema(
  params: CodePropOrParam[],
  typeIndex: Map<string, CodeType>,
): Record<string, unknown> {
  if (params.length === 1) {
    const p0 = params[0];
    const p0Schema = codePropToJsonSchema(p0, typeIndex, new Set<string>());
    if (
      p0Schema && typeof p0Schema === "object" && (p0Schema as { type?: unknown }).type === "object" &&
      "properties" in p0Schema
    ) {
      return { ...(p0Schema as Record<string, unknown>), additionalProperties: false };
    }
    return {
      type: "object",
      properties: { [p0.name]: p0Schema },
      required: p0.optional ? [] : [p0.name],
      additionalProperties: false,
    };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of params) {
    properties[p.name] = codePropToJsonSchema(p, typeIndex, new Set<string>());
    if (!p.optional) required.push(p.name);
  }
  const inputSchema: Record<string, unknown> = {
    type: "object",
    properties,
    additionalProperties: false,
  };
  if (required.length) inputSchema.required = required;
  return inputSchema;
}

/**
 * Recursively relaxes a schema for use as a tool output schema. MCP clients built on the SDK
 * validate `structuredContent` against the advertised `outputSchema` and reject the whole tool
 * result on any mismatch, while tool results come from live APIs whose JSON routinely exceeds the
 * analyzed TypeScript typings: serializers emit explicit `null` for empty fields and APIs return
 * properties the typings don't declare. The output schema therefore documents the shape
 * (properties, types, descriptions) but must not assert closed-world constraints: no `required`,
 * open `additionalProperties`, and every non-root type widened to accept `null`.
 */
function relaxForOutput(schema: Record<string, unknown>, root = false): Record<string, unknown> {
  const out: Record<string, unknown> = { ...schema };
  delete out.required;
  if (out.type === "object") {
    out.additionalProperties = true;
    if (out.properties && typeof out.properties === "object") {
      out.properties = Object.fromEntries(
        Object.entries(out.properties as Record<string, Record<string, unknown>>)
          .map(([key, value]) => [key, relaxForOutput(value)]),
      );
    }
  }
  if (out.items && typeof out.items === "object" && !Array.isArray(out.items)) {
    out.items = relaxForOutput(out.items as Record<string, unknown>);
  }
  if (Array.isArray(out.oneOf)) {
    const members = (out.oneOf as Record<string, unknown>[]).map((m) => relaxForOutput(m));
    out.oneOf = root ? members : [...members, { type: "null" }];
  }
  if (!root && typeof out.type === "string" && out.type !== "null") {
    out.type = [out.type, "null"];
    if (Array.isArray(out.enum) && !out.enum.includes(null)) {
      out.enum = [...out.enum, null];
    }
  }
  return out;
}

/** MCP tool output schema for a function's return value, or undefined when it does not resolve to
 * an object schema. Execution always returns an object (primitives/arrays are wrapped as `{ value }`
 * and the analyzer maps such returns to the system `*Value` types), so a non-object schema here
 * means the type could not be resolved and no `outputSchema` should be advertised. The schema is
 * relaxed for validation against real API results — see {@link relaxForOutput}.
 * @param returns Function return value definition to convert.
 * @param typeIndex Flat type index for resolving named types.
 */
export function buildToolOutputSchema(
  returns: CodePropOrParam,
  typeIndex: Map<string, CodeType>,
): Record<string, unknown> | undefined {
  const schema = codePropToJsonSchema(returns, typeIndex, new Set<string>());
  if ((schema as { type?: unknown }).type !== "object") {
    return undefined;
  }
  return relaxForOutput(schema, true);
}
