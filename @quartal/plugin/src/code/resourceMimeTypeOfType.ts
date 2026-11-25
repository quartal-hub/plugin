import type { Type } from "ts-morph";

/** Byte types a resource method may return, served as a blob. */
const BYTE_TYPES = new Set(["Uint8Array", "ArrayBuffer", "Buffer"]);
/** Properties of a return object that chooses its own content (`{ text }`, `{ blob }`, `{ contents }`). */
const CONTENT_PROPERTIES = ["text", "blob", "contents"];

/**
 * The MIME type a resource method's return type is served with when it has no `@mimeType` tag —
 * the same rule the runtime applies to the value: a string is `text/plain`, bytes are
 * `application/octet-stream`, and any other value (object, array, number, boolean) is
 * `application/json`. `Promise<T>` is unwrapped and `null` / `undefined` are ignored.
 * @param type The checker type of the method's return value.
 * @returns The MIME type, or `undefined` when the type does not decide it: `any` / `unknown`, a
 * union of different kinds, or an object that sets its own content (`{ text }`, `{ blob }`,
 * `{ contents }`).
 */
export function resourceMimeTypeOfType(type: Type): string | undefined {
  const value = unwrapPromise(type);
  const members = (value.isUnion() ? value.getUnionTypes() : [value])
    .filter((t) => !t.isNull() && !t.isUndefined() && !t.isVoid());
  const kinds = new Set(members.map(kindOf));
  if (kinds.size !== 1) return undefined;
  return [...kinds][0];
}

/** `T` of `Promise<T>`, else the type itself. */
function unwrapPromise(type: Type): Type {
  if (type.getSymbol()?.getName() === "Promise") {
    const [inner] = type.getTypeArguments();
    if (inner) return inner;
  }
  return type;
}

/** The MIME type of one non-nullish type, `undefined` when it cannot be told. */
function kindOf(type: Type): string | undefined {
  if (type.isAny() || type.isUnknown()) return undefined;
  if (type.isString() || type.isStringLiteral() || type.isTemplateLiteral()) return "text/plain";
  if (type.isNumber() || type.isNumberLiteral() || type.isBoolean() || type.isBooleanLiteral()) {
    return "application/json";
  }
  const name = type.getSymbol()?.getName();
  if (name && BYTE_TYPES.has(name)) return "application/octet-stream";
  if (type.isArray() || type.isTuple()) return "application/json";
  if (type.isObject()) {
    if (CONTENT_PROPERTIES.some((p) => type.getProperty(p))) return undefined;
    return "application/json";
  }
  return undefined;
}
