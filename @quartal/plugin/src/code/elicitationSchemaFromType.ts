import { type JSDocableNode, Node, type Type } from "ts-morph";

/** JSDoc tags read from a form property, copied onto its schema. */
const NUMBER_TAGS = ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"] as const;
/** String formats MCP elicitation allows in form mode. */
const FORMATS = new Set(["email", "uri", "date", "date-time"]);

/**
 * Builds the restricted JSON Schema of an MCP form elicitation (`requestedSchema`) from the type
 * argument of an `elicitForm<T>()` call. The form is a flat object whose properties are strings
 * (optionally `@format email|uri|date|date-time`), numbers, booleans, string-literal unions
 * (single choice) or arrays of a string-literal union (multiple choice) — the only shapes form mode
 * allows. The property's JSDoc becomes its `title` (or `description` when `@summary` gives the
 * title); `@minimum`, `@maximum`, `@minLength`, `@maxLength`, `@minItems`, `@maxItems`, `@format`
 * and `@default` are copied.
 * @param type The checker type of `T`.
 * @param at The node the type is used at (for property types and error locations).
 * @param where `Class.method` and key, for error messages.
 * @returns The `requestedSchema`.
 * @throws When `T` is not a flat object of allowed property types.
 */
export function elicitationSchemaFromType(type: Type, at: Node, where: string): Record<string, unknown> {
  if (!type.isObject() || type.isArray() || type.getCallSignatures().length > 0) {
    throw new Error(`${where}: elicitForm<T> needs an object type, got "${type.getText(at)}".`);
  }
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const symbol of type.getProperties()) {
    const name = symbol.getName();
    const decl = symbol.getDeclarations()[0];
    const propType = symbol.getTypeAtLocation(at);
    const optional = symbol.isOptional();
    const schema = propertySchema(nonUndefined(propType), at, `${where} → ${name}`);
    if (decl && Node.isJSDocable(decl)) applyJsDoc(schema, decl);
    properties[name] = schema;
    if (!optional) required.push(name);
  }
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  };
}

function nonUndefined(type: Type): Type {
  if (!type.isUnion()) return type;
  const members = type.getUnionTypes().filter((t) => !t.isUndefined() && !t.isNull());
  return members.length === 1 ? members[0] : type;
}

function stringLiterals(type: Type): string[] | undefined {
  const members = type.isUnion() ? type.getUnionTypes() : [type];
  if (!members.every((m) => m.isStringLiteral())) return undefined;
  return members.map((m) => m.getLiteralValue() as string);
}

function propertySchema(type: Type, at: Node, where: string): Record<string, unknown> {
  if (type.isString()) return { type: "string" };
  if (type.isNumber()) return { type: "number" };
  if (type.isBoolean() || type.isBooleanLiteral()) return { type: "boolean" };
  const literals = stringLiterals(type);
  if (literals) return { type: "string", enum: literals };
  if (type.isArray()) {
    const items = stringLiterals(nonUndefined(type.getArrayElementTypeOrThrow()));
    if (items) return { type: "array", items: { type: "string", enum: items } };
  }
  throw new Error(
    `${where}: "${type.getText(at)}" is not allowed in an elicitation form — use string, number, boolean, a string-literal union or an array of one.`,
  );
}

function applyJsDoc(schema: Record<string, unknown>, decl: JSDocableNode): void {
  const docs = decl.getJsDocs();
  const text = docs.map((d) => d.getDescription().trim()).filter(Boolean).join("\n").trim();
  const tags = new Map<string, string>();
  for (const doc of docs) {
    for (const tag of doc.getTags()) tags.set(tag.getTagName(), (tag.getCommentText() ?? "").trim());
  }
  const summary = tags.get("summary");
  if (summary) {
    schema.title = summary;
    if (text) schema.description = text;
  } else if (text) {
    schema.title = text;
  }
  for (const tag of NUMBER_TAGS) {
    const value = tags.get(tag);
    if (value !== undefined && value !== "" && !Number.isNaN(Number(value))) schema[tag] = Number(value);
  }
  const format = tags.get("format");
  if (format && schema.type === "string" && FORMATS.has(format)) schema.format = format;
  const def = tags.get("default");
  if (def !== undefined && def !== "") {
    try {
      schema.default = JSON.parse(def);
    } catch {
      schema.default = def;
    }
  }
}
