import type { CodeClass, CodeFile, CodeFunction, CodePropOrParam, CodeType, RestMethod, RestRoute } from "../model/index.ts";
import { buildTypeIndex } from "./buildTypeIndex.ts";

/**
 * Leading method-name verbs that pick the HTTP method (ASP.NET Web API action prefixes, the Google
 * API design guide's standard methods and the Feathers / LoopBack service verbs). A name with any
 * other verb is a custom method: POST at its full name.
 */
const VERB_METHODS: Record<string, RestMethod> = {
  get: "GET",
  list: "GET",
  find: "GET",
  create: "POST",
  post: "POST",
  update: "PUT",
  replace: "PUT",
  put: "PUT",
  delete: "DELETE",
  remove: "DELETE",
};

/** Methods whose convention route takes a required `id` input property as the `{id}` path parameter. */
const ID_IN_PATH: ReadonlySet<RestMethod> = new Set<RestMethod>(["GET", "PUT", "DELETE"]);

/** TypeScript keywords that can appear in a union and are never enum members. */
const TYPE_KEYWORDS = new Set(["string", "number", "boolean", "null", "undefined", "void", "any", "unknown", "never", "object", "symbol", "bigint"]);

/**
 * The system wrapper types the analyzer assigns to a parameter typed `void`, `null`, `undefined`,
 * `any` or `unknown` (see `getSystemCodeFile`): such a method takes no input over REST.
 */
const NO_INPUT_TYPES = new Set(["VoidValue", "NullValue", "UndefinedValue", "UnknownValue"]);

/** Methods that carry the remaining input in the query string instead of a JSON body. */
export const QUERY_METHODS: ReadonlySet<RestMethod> = new Set<RestMethod>(["GET", "DELETE"]);

/**
 * `HelloWorld` → `hello-world`, `getHTTPStatus` → `get-http-status`, `v2_report` → `v2-report`.
 * @param name A class or method name.
 */
export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Key of a method in the map {@link resolveRestRoutes} returns. */
export function restRouteKey(className: string, methodName: string): string {
  return `${className}.${methodName}`;
}

/**
 * Splits a method name into a recognised leading verb and the remainder (`getInvoice` →
 * `{ verb: "get", rest: "Invoice" }`). The verb must be followed by an upper-case letter, a digit,
 * `_` or the end of the name, so `listen` is not `list`.
 * @param name The method name.
 */
export function splitLeadingVerb(name: string): { verb: string; rest: string } | undefined {
  for (const verb of Object.keys(VERB_METHODS)) {
    if (!name.startsWith(verb)) continue;
    const next = name.charAt(verb.length);
    if (next === "" || /[A-Z0-9_]/.test(next)) {
      return { verb, rest: name.slice(verb.length).replace(/^_+/, "") };
    }
  }
  return undefined;
}

/**
 * Resolves the REST route of every tool method: the naming convention, then the class `@rest`
 * path, then the method `@rest` tag. Validates path parameters and the GET/DELETE input rules and
 * throws a descriptive `Error` on the first violation or duplicate route, so a build fails instead
 * of serving an impossible operation. Methods (or classes) marked `@rest hidden` get no route.
 * @param codeFiles Analyzed code files (the system types file is skipped).
 * @param basePath API base path every route lives under (default `/api`).
 * @returns Routes keyed by {@link restRouteKey}, in source order.
 */
export function resolveRestRoutes(codeFiles: CodeFile[], basePath = "/api"): Map<string, RestRoute> {
  const typeIndex = buildTypeIndex(codeFiles);
  const routes = new Map<string, RestRoute>();
  const owners = new Map<string, string>();
  const base = basePath.replace(/\/+$/, "");

  for (const file of codeFiles) {
    if (file.path === "__system__.ts") continue;
    for (const cls of file.classes) {
      if (cls.rest?.hidden) continue;
      const classPath = cls.rest?.path !== undefined
        ? joinRestPath(base, base, cls.rest.path, cls.name)
        : `${base}/${toKebabCase(cls.name)}`;
      for (const fn of cls.functions) {
        if (fn.rest?.hidden) continue;
        const where = restRouteKey(cls.name, fn.name);
        const route = resolveRestRoute(cls, fn, classPath, base, typeIndex, where);
        const routeId = `${route.method} ${route.path}`;
        const owner = owners.get(routeId);
        if (owner) {
          throw new Error(
            `${where}: REST route ${routeId} is already used by ${owner}; rename one of them or give it an explicit @rest path`,
          );
        }
        owners.set(routeId, where);
        routes.set(where, route);
      }
    }
  }
  return routes;
}

/**
 * The properties of a tool method's single input object, following `extends`; `undefined` when
 * the method takes no input object (no parameter, or `void` / `null` / `any` / `unknown`).
 * @param fn The tool method.
 * @param typeIndex Flat type index from {@link buildTypeIndex}.
 */
export function resolveInputProperties(
  fn: CodeFunction,
  typeIndex: Map<string, CodeType>,
): CodePropOrParam[] | undefined {
  const param = fn.parameters[0];
  if (!param) return undefined;
  if (typeof param.type === "string" && NO_INPUT_TYPES.has(param.type.trim())) return undefined;
  const type = typeof param.type === "string" ? typeIndex.get(param.type.trim()) : param.type;
  if (!type || typeof type !== "object" || !("properties" in type) || type.enum?.length) return undefined;
  const out: CodePropOrParam[] = [];
  const seen = new Set<string>();
  const collect = (ct: CodeType): void => {
    if (ct.name && seen.has(ct.name)) return;
    if (ct.name) seen.add(ct.name);
    for (const baseName of ct.extends) {
      const baseType = typeIndex.get(baseName);
      if (baseType) collect(baseType);
    }
    for (const prop of ct.properties) {
      const at = out.findIndex((p) => p.name === prop.name);
      if (at >= 0) out[at] = prop;
      else out.push(prop);
    }
  };
  collect(type);
  return out;
}

function resolveRestRoute(
  cls: CodeClass,
  fn: CodeFunction,
  /** The class path including the base path (`/api/invoices`). */
  classPath: string,
  base: string,
  typeIndex: Map<string, CodeType>,
  where: string,
): RestRoute {
  const props = resolveInputProperties(fn, typeIndex);
  const verb = splitLeadingVerb(fn.name);
  const method = fn.rest?.method ?? (verb ? VERB_METHODS[verb.verb] : "POST");

  let path: string;
  if (fn.rest?.path !== undefined) {
    path = joinRestPath(base, classPath, fn.rest.path, where);
  } else {
    let byId = false;
    let segment: string;
    if (verb) {
      let rest = verb.rest;
      if (rest.endsWith("ById")) {
        rest = rest.slice(0, -"ById".length);
        byId = true;
      }
      segment = namesClass(rest, cls.name) ? "" : toKebabCase(rest);
    } else {
      segment = toKebabCase(fn.name);
    }
    path = `${classPath}${segment ? `/${segment}` : ""}`;
    const id = props?.find((p) => p.name === "id");
    const idFitsPath = !!id && !id.optional && !id.nullable && isPrimitive(id, typeIndex);
    if (byId && !idFitsPath) {
      throw new Error(`${where}: a "...ById" method needs a required string, number or boolean input property named "id"`);
    }
    if (ID_IN_PATH.has(method) && idFitsPath) path += "/{id}";
  }

  const pathParams = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  for (const name of pathParams) {
    const prop = props?.find((p) => p.name === name);
    if (!prop) {
      throw new Error(`${where}: path parameter {${name}} of ${method} ${path} is not a property of the input object`);
    }
    if (prop.optional || prop.nullable || !isPrimitive(prop, typeIndex)) {
      throw new Error(
        `${where}: path parameter {${name}} must be a required, non-null string, number or boolean (input property "${name}" is ${describeProp(prop)})`,
      );
    }
  }
  const remaining = props?.filter((p) => !pathParams.includes(p.name)) ?? [];
  if (QUERY_METHODS.has(method) && props) {
    for (const prop of remaining) {
      if (prop.nullable || !isPrimitive(prop, typeIndex)) {
        throw new Error(
          `${where}: ${method} sends the input as query parameters, so every property must be a string, number or boolean (property "${prop.name}" is ${describeProp(prop)}); use @rest POST for richer input`,
        );
      }
    }
  }
  const inputIn = QUERY_METHODS.has(method)
    ? (remaining.length ? "query" : "none")
    : (props && !remaining.length ? "none" : "body");
  return { method, path, pathParams, inputIn };
}

/**
 * Resolves a `@rest` path: without a leading `/` it is appended to `parent` (the base path for a
 * class, the class path for a method); with one it is the full path and must start with the base
 * path, so a path names its root explicitly.
 */
function joinRestPath(base: string, parent: string, path: string, where: string): string {
  if (!path.startsWith("/")) return `${parent}/${path}`;
  if (path !== base && !path.startsWith(`${base}/`)) {
    throw new Error(
      `${where}: @rest path "${path}" must start with the API base path "${base}" (as in "${base}${path}"), or leave out the leading "/" for a path relative to ${parent}`,
    );
  }
  return path;
}

/** Whether `rest` names the class: equal to the class name ignoring one trailing `s` on either side, case-insensitively. */
function namesClass(rest: string, className: string): boolean {
  if (!rest) return true;
  const singular = (s: string) => s.toLowerCase().replace(/s$/, "");
  return singular(rest) === singular(className);
}

/** `string`, `number`, `boolean`, a string-literal union or an enum alias: representable as one query/path value. */
function isPrimitive(prop: CodePropOrParam, typeIndex: Map<string, CodeType>): boolean {
  if (typeof prop.type !== "string") return false;
  const t = prop.type.trim();
  if (t === "string" || t === "number" || t === "boolean") return true;
  if (t.includes(" | ")) {
    // The analyzer writes a string-literal union as its members joined by " | " (quotes dropped).
    return t
      .split("|")
      .map((p) => p.trim())
      .every((p) => /^["'].*["']$/.test(p) || (/^[A-Za-z_][A-Za-z0-9_]*$/.test(p) && !TYPE_KEYWORDS.has(p)));
  }
  const named = typeIndex.get(t);
  return !!named?.enum?.length;
}

function describeProp(prop: CodePropOrParam): string {
  const type = typeof prop.type === "string" ? prop.type : "items" in prop.type ? "an array" : "an object";
  return `${type}${prop.optional ? ", optional" : ""}${prop.nullable ? ", nullable" : ""}`;
}
