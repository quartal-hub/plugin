import type { RestClassDeclaration, RestMethod, RestRouteDeclaration } from "../model/index.ts";

/** HTTP methods the REST API serves, in the order error messages list them. */
export const REST_METHODS: readonly RestMethod[] = ["GET", "POST", "PUT", "DELETE"];

/** Every HTTP method name: a token matching one of these is read as a method, never as a path. */
const HTTP_METHOD_WORDS = new Set(["GET", "HEAD", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE", "PATCH"]);

/**
 * Parses the text of a `@rest` JSDoc tag on a tool method: `[METHOD] [path]`, separated by
 * whitespace. The first token is the method when it is an HTTP method name (case-insensitive);
 * anything else is the path. Throws on an unsupported method, on more than two tokens and on a
 * malformed path.
 * @param text Tag text after `@rest`.
 * @param where `Class.method`, used as the error prefix.
 */
export function parseRestTag(text: string, where: string): RestRouteDeclaration {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error(`${where}: @rest needs a method (${REST_METHODS.join(", ")}), a path, or both`);
  }
  if (tokens.length > 2) {
    throw new Error(`${where}: @rest takes a method and a path at most, got "${tokens.join(" ")}"`);
  }
  const out: RestRouteDeclaration = {};
  const [first, second] = tokens;
  if (second !== undefined || HTTP_METHOD_WORDS.has(first.toUpperCase())) {
    out.method = parseMethod(first, where);
  }
  const path = second ?? (out.method ? undefined : first);
  if (path !== undefined) out.path = validateRestPath(path, where);
  return out;
}

/**
 * Parses the text of a `@rest` JSDoc tag on a tool class: a single path, kept as written (a leading
 * `/` means the full path including the API base path, otherwise the path is relative to the
 * base path). A method word is an error, since a method cannot be set class-wide.
 * @param text Tag text after `@rest`.
 * @param where The class name, used as the error prefix.
 */
export function parseRestClassTag(text: string, where: string): RestClassDeclaration {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 1 || HTTP_METHOD_WORDS.has(tokens[0].toUpperCase())) {
    throw new Error(
      `${where}: a class-level @rest takes only a path (the HTTP method is set per method), got "${text.trim()}"`,
    );
  }
  return { path: validateRestPath(tokens[0], where) };
}

function parseMethod(word: string, where: string): RestMethod {
  const upper = word.toUpperCase() as RestMethod;
  if (!REST_METHODS.includes(upper)) {
    throw new Error(`${where}: @rest method "${word}" is not supported; use one of ${REST_METHODS.join(", ")}`);
  }
  return upper;
}

/**
 * Checks a `@rest` path: segments separated by `/`, each either a literal or a whole `{param}`,
 * no query string or fragment. A trailing `/` is dropped.
 */
function validateRestPath(path: string, where: string): string {
  if (/[?#]/.test(path)) {
    throw new Error(`${where}: @rest path "${path}" must not contain a query string or fragment`);
  }
  if (/(^|\/):\w/.test(path)) {
    throw new Error(`${where}: @rest path "${path}" uses ":param"; write path parameters as {param}`);
  }
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const segments = trimmed.replace(/^\//, "").split("/");
  for (const segment of segments) {
    if (segment === "" && trimmed !== "/") {
      throw new Error(`${where}: @rest path "${path}" has an empty segment`);
    }
    if ((segment.includes("{") || segment.includes("}")) && !/^\{[A-Za-z_$][\w$]*\}$/.test(segment)) {
      throw new Error(`${where}: @rest path parameter "${segment}" must be a whole segment like {id}`);
    }
  }
  return trimmed;
}
