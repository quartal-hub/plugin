---
title: "Resources"
description: "Serve read-only context — documents, policies, files — as MCP resources from plain TypeScript methods."
section: creating
order: 4.5
---

An MCP **resource** is read-only content an agent or a user can pull into a conversation by its
URI: a policy document, a price list, a company's file. Tools *do* things; resources *are* things.
In a Quartal Plugin a resource is a method with a `@uri` tag.

```ts
// file: src/resources/Policies.ts
export type ExpenseCategory = "travel" | "meals" | "equipment";

/** The company's policies. */
export class Policies {
  /**
   * The travel policy.
   * @summary Travel policy
   * @uri policy://travel
   * @mimeType text/markdown
   * @cache 5m public
   */
  travel(): string {
    return travelPolicyMarkdown;
  }

  /**
   * The rules of one expense category.
   * @uri policy://expenses/{category}
   */
  expense(input: { category: ExpenseCategory }): string {
    return rulesFor(input.category);
  }
}
```

```ts
// file: src/resources/mod.ts
export * from "./Policies.ts";
```

Every method of a class exported from `src/resources/mod.ts` is a resource:

| Tag | Meaning |
|---|---|
| `@uri` | **Required.** The URI the resource is read at. Any scheme works (`policy://`, `price-list://`). |
| `@mimeType` | The content type. Without it, the type follows from what the method returns (below). |
| `@cache <duration> [public]` | How long clients may cache a read (`30s`, `5m`, `1h`). `public` lets a cache share it between users; the default is per user. |
| `@summary` | The resource's display title. |

The JSDoc text is the description the agent reads.

## Templates

A URI with `{variables}` is a **resource template**: one method serves a whole family of URIs.
Each variable must be a property of the method's input object, and receives the matching part of
the URI as a string (`policy://expenses/meals` → `{ category: "meals" }`). Templates are listed in
`resources/templates/list`; fixed URIs in `resources/list`.

## What a method returns

| Return value | Served as | Default MIME type |
|---|---|---|
| `string` | Text. | `text/plain` |
| `Uint8Array` | A binary blob (base64 on the wire). | `application/octet-stream` |
| `{ text, mimeType? }` or `{ blob, mimeType? }` | Text or bytes with their own MIME type. | `text/plain` / `application/octet-stream` |
| anything else (an object, array, number or boolean) | JSON text. | `application/json` |

The MIME type is also listed with the resource in `resources/list`, so a client knows what it
reads before it reads it. A `@mimeType` tag overrides the default — for example `text/markdown`
for a string, or `application/geo+json` for an object. When the return type does not settle it
(`unknown`, or a union of a string and an object), the resource is listed without a MIME type and
each read carries the type of the value it returned.

Like tools, a resource method receives the call's context as its second parameter, so in a plugin
with authentication it reads with the signed-in user's rights. The build fails when a method has no
`@uri`, two methods share a URI, or a template variable is not a property of the input.

## Where resources show up

- Over MCP at `/mcp`: `resources/list`, `resources/templates/list` and `resources/read`, next to
  your widgets and your [skills](/docs/skills/agent-skills).
- `GET /mcp/resources.json` mirrors `resources/list`.

How a client offers resources differs: Claude Code and Claude Desktop let users attach them, other
clients read them when a tool result or a skill points to them.
