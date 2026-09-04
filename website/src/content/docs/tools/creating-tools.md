---
title: "Creating tools"
description: "From a hello-world class to a fully documented tool: types, descriptions, and every JSDoc tag."
section: tools
order: 1
---

A **tool** is a plain TypeScript function that AI agents can call. In a Quartal Plugin you never
write schemas by hand — you write a class with typed methods, and the framework generates the
MCP tool definitions and the OpenAPI (REST) actions from your code and JSDoc comments.

## Hello world

Create a class in `src/tools/` and export it from `src/tools/mod.ts`:

```ts
// file: src/tools/HelloWorld.ts

/** A class that says hello to the world. */
export class HelloWorld {
  /**
   * Greets the caller by name.
   * @param input The greeting parameters.
   * @returns A friendly greeting.
   */
  sayHello(input: { /** Name of the person to greet. */ name: string }): string {
    return `Hello, ${input.name}!`;
  }
}
```

```ts
// file: src/tools/mod.ts

// Every public method of every class exported here becomes
// an MCP tool AND an OpenAPI / REST action.
export * from "./HelloWorld.ts";
```

That's it. Run `pnpm dev` and your plugin now serves:

- an MCP tool named `sayHello` on the `/mcp` endpoint
- a REST action at `POST /api/HelloWorld/sayHello`
- documentation for both at `/` (the built-in docs site)

Both instance methods and `static` methods work. `private` methods (and private properties) are
never exposed.

## How a method becomes a tool

| Tool field | Comes from | Notes |
|---|---|---|
| `name` | Method name | Prefixed with the class name (`Class_method`) only when the same method name exists in two classes. Characters outside `a–z A–Z 0–9 _ -` are replaced with `_`; max 128 characters. |
| `title` | `@summary` JSDoc tag | Optional short display name. |
| `description` | JSDoc body | The full comment text above the tags; paragraphs are kept. This is the main text the agent reads. |
| `inputSchema` | The method's **first parameter** | See [Input types](#input-types). Any further parameters are treated as injected context (auth, request, …) and never appear in the schema. |
| `outputSchema` | The method's return type | `Promise<T>` is unwrapped to `T`. See [Output types](#output-types). |
| `_meta.ui.resourceUri` | A widget page for this tool | Added automatically when the tool has a [widget](/docs/widgets/mcp-apps-widgets). |
| `_meta.ui.visibility` | `@visibility` JSDoc tag | Who may call the tool — see [`@visibility`](#visibility) below. |

## Input types

Design your tool method to take a **single input object** — its properties become the schema
properties directly (the object is "unwrapped", there is no extra nesting level). The input type
can be inline (like the hello world above) or a named interface, even one imported from another
package:

```ts
// file: src/tools/CreateUserInput.ts

/** Input for creating a user. */
export interface CreateUserInput {
  /** User's full name. */
  name: string;
  /**
   * Valid email address.
   * @format email
   */
  email: string;
  /**
   * User's age, optional.
   * @format int32
   */
  age?: number;
  /** User role. */
  role: "admin" | "user";
}
```

### TypeScript → JSON Schema

| You write | The agent sees |
|---|---|
| `string`, `number`, `boolean` | `{ "type": "string" \| "number" \| "boolean" }` |
| `Foo[]`, `Array<Foo>` | `{ "type": "array", "items": … }` |
| Named interface / type alias | Inlined object schema with all its properties; `extends` chains are flattened in. |
| `"a" \| "b" \| "c"` (string literal union) | `{ "type": "string", "enum": ["a", "b", "c"] }` |
| Other unions (`Foo \| Bar`) | `{ "oneOf": [ …, … ] }` |
| `name?: string` (optional) | Property present, but omitted from `required`. |
| `string \| null` | Treated as `string`; the property is still required unless also optional. |
| `any`, `unknown`, unresolvable types | `{}` (anything allowed) |
| `object`, `Record<string, …>` | `{ "type": "object", "additionalProperties": true }` |
| Recursive types (a tree node referencing itself) | The nested occurrence becomes an open object — recursion is cut, not followed. |

Input schemas are **strict**: `additionalProperties: false` and every non-optional property is
listed in `required`. This is intentional — the agent constructs the input, and a strict schema
steers it to the exact shape your method expects.

## Output types

The return type produces the tool's `outputSchema`. A tool result is always a JSON **object**; if
your method returns a primitive or an array, the runtime wraps it — and the schema reflects that:

| Return type | Runtime result | Output schema shape |
|---|---|---|
| `Invoice` (object type) | The object as-is | Object schema with its properties |
| `number` / `string` / `boolean` / array | `{ "value": 5 }` | `{ "value": … }` |
| `void` / `undefined` | `{}` | Empty object |

Output schemas are deliberately **looser** than input schemas: extra properties are allowed, no
property is `required`, and every type is widened to also accept `null`. MCP clients validate
results against the advertised schema, and real-world results (especially from upstream APIs)
routinely contain nulls and undeclared fields — a strict output schema would make legitimate
results fail. In short: the input schema is a contract the agent must fulfill; the output schema
is documentation of what the agent can expect.

## Descriptions

Descriptions and types are the most important information passed via MCP all the way to the AI
agent — they are how the agent decides *whether* and *how* to call your tool.

- The JSDoc **body on the method** becomes the tool's `description`.
- The JSDoc **body on each property** becomes that property's `description`.
- Write a description for **every** property; use `@example` for anything non-obvious.

## JSDoc tag reference

### Tags on the tool method

| Tag | Purpose | Example |
|---|---|---|
| `@summary` | Short display name — MCP `title` / OpenAPI `summary`. | `@summary Create invoice` |
| `@param` | Description of the input object itself (first parameter). | `@param input The invoice fields.` |
| `@returns` | Description of the output schema. | `@returns The created invoice.` |
| `@visibility` | Who may call the tool — see below. | `@visibility app` |

### Tags on input/output properties

| Tag | Purpose | Example |
|---|---|---|
| `@summary` | Short display name — the property's schema `title`. | `@summary Due date` |
| `@format` | JSON Schema `format` for string properties: `date`, `date-time`, `time`, `duration`, `email`, `uri`, `uri-reference`, `uuid`, … | `@format date` |
| `@example` | Example value — parsed as JSON when possible, otherwise kept as text. | `@example { "name": "Ada" }` |

### `@visibility`

By default every tool is visible to the AI model *and* callable by your plugin's own widgets.
The `@visibility` tag narrows that, using the scopes defined by the
[MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) standard:

- `model` — the tool is visible to and callable by the AI agent.
- `app` — the tool is callable by this plugin's widgets (the "app") only.

```ts
/**
 * Returns paged rows for the invoice-list widget.
 *
 * The model should call `listInvoices` instead; this variant exists for
 * the widget's infinite scroll and is hidden from the model.
 * @visibility app
 */
async fetchInvoiceRows(input: FetchInvoiceRowsInput): Promise<InvoiceRowsPage> { … }
```

Multiple scopes are space- or comma-separated (`@visibility model, app`). Omitting the tag is the
same as allowing both — hosts default to `["model", "app"]`. The value is advertised to MCP
clients as `_meta.ui.visibility` on the tool.

Typical use: a **widget helper tool** (`@visibility app`) that returns fine-grained UI data the
model should never call directly — keeping the model's tool list small and focused.

## Practical tips

- Write a JSDoc description for **every** method and property — descriptions are the main thing
  the agent reads when deciding how to call your tool.
- Use string literal unions (`"fi" | "sv" | "en"`) for closed value sets — they become `enum`s
  the agent cannot get wrong.
- Mark truly optional properties with `?` — everything else becomes `required` in the input
  schema.
- Use `@example` on non-obvious properties; agents follow examples closely.
- Keep the model's tool list small: mark widget-only helpers with `@visibility app`.
