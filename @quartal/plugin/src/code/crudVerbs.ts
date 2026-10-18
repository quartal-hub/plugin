import type { McpToolAnnotations, RestMethod } from "../model/index.ts";

/** What a recognised leading verb of a method name implies on both surfaces. */
export interface CrudVerb {
  /** HTTP method of the REST operation. */
  method: RestMethod;
  /** MCP tool annotations the verb implies; explicit `@readOnly` & co. override them. */
  annotations?: McpToolAnnotations;
  /** Whether the verb addresses the collection (`list`, `find`): the class noun stays as written. */
  collection?: boolean;
}

/**
 * Leading method-name verbs and what they mean: the HTTP method (ASP.NET Web API action prefixes,
 * the Google API design guide's standard methods, the Feathers / LoopBack service verbs) and the
 * MCP behaviour hints that follow from it. A name with any other verb is a custom method: POST at
 * its full name, no implied hints.
 */
export const CRUD_VERBS: Record<string, CrudVerb> = {
  get: { method: "GET", annotations: { readOnlyHint: true } },
  list: { method: "GET", annotations: { readOnlyHint: true }, collection: true },
  find: { method: "GET", annotations: { readOnlyHint: true }, collection: true },
  create: { method: "POST", annotations: { destructiveHint: false } },
  post: { method: "POST", annotations: { destructiveHint: false } },
  update: { method: "PUT", annotations: { idempotentHint: true } },
  replace: { method: "PUT", annotations: { idempotentHint: true } },
  put: { method: "PUT", annotations: { idempotentHint: true } },
  delete: { method: "DELETE", annotations: { destructiveHint: true, idempotentHint: true } },
  remove: { method: "DELETE", annotations: { destructiveHint: true, idempotentHint: true } },
};

/**
 * Splits a method name into a recognised leading verb and the remainder (`getInvoice` →
 * `{ verb: "get", rest: "Invoice" }`). The verb must be followed by an upper-case letter, a digit,
 * `_` or the end of the name, so `listen` is not `list`.
 * @param name The method name.
 */
export function splitLeadingVerb(name: string): { verb: string; rest: string } | undefined {
  for (const verb of Object.keys(CRUD_VERBS)) {
    if (!name.startsWith(verb)) continue;
    const next = name.charAt(verb.length);
    if (next === "" || /[A-Z0-9_]/.test(next)) {
      return { verb, rest: name.slice(verb.length).replace(/^_+/, "") };
    }
  }
  return undefined;
}

/**
 * The class name as the noun of a method: singular (one trailing `s` dropped) for a method that
 * addresses one item, as written for a collection verb. `Invoices` → `Invoice` / `Invoices`.
 * @param className The class name.
 * @param collection Whether the verb addresses the collection (`list`, `find`).
 */
export function classNoun(className: string, collection: boolean): string {
  return collection ? className : className.replace(/s$/, "");
}

/** Whether `rest` names the class: equal to the class name ignoring one trailing `s` on either side, case-insensitively. */
export function namesClass(rest: string, className: string): boolean {
  if (!rest) return true;
  const singular = (s: string) => s.toLowerCase().replace(/s$/, "");
  return singular(rest) === singular(className);
}

/**
 * The MCP tool annotations a method implies: the verb's defaults under the explicit `@readOnly`,
 * `@destructive`, `@idempotent` and `@openWorld` tags. `undefined` when neither says anything.
 * @param methodName The method name.
 * @param declared Annotations from the method's JSDoc tags.
 */
export function resolveToolAnnotations(
  methodName: string,
  declared: McpToolAnnotations | undefined,
): McpToolAnnotations | undefined {
  const verb = splitLeadingVerb(methodName);
  const implied = verb ? CRUD_VERBS[verb.verb].annotations : undefined;
  if (!implied && !declared) return undefined;
  return { ...implied, ...declared };
}
