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
