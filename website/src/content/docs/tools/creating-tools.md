---
title: "Tools"
description: "From a hello-world class to a fully documented tool: types, descriptions, and every JSDoc tag."
section: creating
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
- a REST action at `POST /api/hello-world/say-hello` (see [REST routes](#rest-routes))
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

## Where the types live

Keep the types of your tools in `src/tools/` — by convention in a `model/` folder with an `index.ts` barrel
— and re-export them from `src/tools/mod.ts` next to the tool classes:

```ts
// file: src/tools/mod.ts
export * from "./model/index.ts";   // the input, output and shared types
export * from "./Invoices.ts";      // the tool classes
```

The generator starts from the **first parameter and the return type of each tool method** and follows
every type they refer to — property types, array items, `extends` chains, unions — however deep, and
describes each one with its JSDoc. A type is found wherever it is declared: in `src/tools/`, elsewhere in your
project, or in a package. Types exported from `mod.ts` are listed as the plugin's own types in the docs site;
the others are listed with the imported types. In both cases the schema in `open-api.json` and in the MCP
tool definitions describes them in full.

What the generator reads is the **signature**: a type that is only used inside a method body is not followed, and a
type it cannot resolve (`any`, `unknown`, a type from a package without declarations) becomes `{}`. To check
the result, open the tool in the docs site at `/` or read `/open-api.json`: a property with an empty schema (no
type and no description) means that the type was not resolved.

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

## REST routes

Every tool is also one operation of the plugin's REST API, documented in `open-api.json` and
served under `/api`. The route follows from the class and method names; a `@rest` tag overrides
it. The MCP tool name and schema are never affected by any of this.

### The naming convention

The route is `/api/<class>[/<segment>][/{id}]`:

- **`<class>`** is the class name in kebab-case (`HelloWorld` → `hello-world`), or the class's
  `@rest` path.
- The **leading verb** of the method name picks the HTTP method, the rest of the name becomes
  the segment. A segment that just repeats the class name (singular or plural) is dropped.
- **`{id}`** is appended for GET, PUT and DELETE when the input object has a required `id`
  property of type `string`, `number` or `boolean`, or when the method name ends in `ById`.

| Method name starts with | HTTP method | Example (`class Invoices`) |
|---|---|---|
| `get` | `GET` | `getInvoice({ id })` → `GET /api/invoices/{id}`, `getStats()` → `GET /api/invoices/stats` |
| `list`, `find` | `GET` | `listInvoices({ page? })` → `GET /api/invoices?page=` |
| `create`, `post` | `POST` | `createInvoice(fields)` → `POST /api/invoices` |
| `update`, `replace`, `put` | `PUT` | `updateInvoice({ id, …fields })` → `PUT /api/invoices/{id}` |
| `delete`, `remove` | `DELETE` | `deleteInvoice({ id })` → `DELETE /api/invoices/{id}` |
| anything else | `POST` | `approve({ id })` → `POST /api/invoices/approve`, `sayHello(…)` → `POST /api/hello-world/say-hello` |

The verb must be a whole word (`listen` is not `list`). Methods with any other verb are *custom
methods*: always POST, at their full kebab-cased name. `search` is deliberately one of them, since
searches tend to carry structured filters that a query string cannot express.

A plain CRUD class therefore needs no tags at all:

```ts
export class Invoices {
  list(input: { page?: number }) {}                 // GET    /api/invoices?page=
  get(input: { id: string }) {}                     // GET    /api/invoices/{id}
  create(input: InvoiceFields) {}                   // POST   /api/invoices
  update(input: { id: string } & InvoiceFields) {}  // PUT    /api/invoices/{id}   body: InvoiceFields
  delete(input: { id: string }) {}                  // DELETE /api/invoices/{id}
  approve(input: { id: string }) {}                 // POST   /api/invoices/approve
}
```

The same rules are used by ASP.NET Web API (action-name prefixes), the Google API design guide
(the `Get`, `List`, `Create`, `Update`, `Delete` standard methods) and the Feathers / LoopBack
service verbs, so a REST client built against another such API finds familiar routes.

### `@rest` on a class

```ts
/** Invoicing tools.
 * @rest invoicing
 */
export class InvoiceTools { … }
```

A path only. It replaces the kebab-cased class name in every route of the class: `invoicing`
puts the class at `/api/invoicing`. A path with a leading `/` is the full path as served and must
start with `/api` (`@rest /api/invoicing`); anything else with a leading `/` fails the build.
The path may contain parameters (`@rest companies/{businessId}`); every method's input must
then have that property.

### `@rest` on a method

```
@rest [METHOD] [path]
```

Method and path are separated by whitespace, the way an endpoint is written anywhere else
(`DELETE /invoices/{id}`). `METHOD` is one of `GET`, `POST`, `PUT`, `DELETE` (any case). Examples
on a method `purgeOld` of `class Invoices`:

| Tag | Operation |
|---|---|
| `@rest DELETE` | `DELETE /api/invoices/purge-old` — method from the tag, path by convention (the `{id}` rule still applies) |
| `@rest DELETE old` | `DELETE /api/invoices/old` — a relative path is appended to the class path |
| `@rest DELETE /api/maintenance/old` | `DELETE /api/maintenance/old` — a path starting with `/` is the full path; it must start with `/api` |
| `@rest old/{year}` | `POST /api/invoices/old/{year}` — path only, method by convention |

An explicit path is used as written: no segment from the name and no automatic `{id}`. Path
parameters are written as `{name}` and must be properties of the input object. The leading `/`
rule is the same on both levels: without it the path is relative (to `/api` for a class, to the
class path for a method); with it the path is the full path and names its root, so
`@rest GET /invoices/stats` is an error rather than a route at `/api/invoices/stats`.

### Where the input goes

The tool method always receives its one input object; the REST layer takes it apart and puts it
back together:

| HTTP method | Path parameters | Rest of the input |
|---|---|---|
| `GET`, `DELETE` | `{name}` segments | query string, one parameter per property |
| `POST`, `PUT` | `{name}` segments | JSON body (omitted when the path binds everything) |

Property names stay exactly as declared in TypeScript (`?businessId=…`, not `business-id`).
Query and path values arrive as text, so `number` and `boolean` properties accept `42`, `true`,
`false`, `1` and `0`.

### What a route may carry

The build fails with a message naming the method when:

- a path parameter is optional, nullable, or not a `string`, `number` or `boolean`
  (string-literal unions and enum aliases count as strings);
- a `GET` or `DELETE` input has a property that is an array, an object, a `Date` or nullable —
  add `@rest POST` to such a method, or move it off the `get` / `list` / `find` / `delete` verbs;
- two methods resolve to the same method and path.

Nothing else from OpenAPI is modelled: no `PATCH`, headers, cookies or non-JSON bodies.

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
| `@readOnly` | The tool changes nothing — see [Read-only and other hints](#read-only-and-other-hints). | `@readOnly` |
| `@destructive`, `@idempotent`, `@openWorld` | Further behavior hints for the host — same section. | `@destructive false` |
| `@rest` | HTTP method and/or path of the REST operation — see [REST routes](#rest-routes). | `@rest DELETE archive/{id}` |

### Tags on the tool class

| Tag | Purpose | Example |
|---|---|---|
| `@rest` | Path of the class on the REST API, replacing the kebab-cased class name — see [REST routes](#rest-routes). | `@rest invoicing` |

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

### Read-only and other hints

MCP hosts decide whether to ask the user before a tool runs from the tool's **annotations**. A tool that says nothing
is treated as one that may change or delete data, so a host such as Claude asks for approval on every call — slow
when an agent reads many records. Declare what a tool does with JSDoc tags on the method:

| Tag | MCP annotation | Meaning |
|---|---|---|
| `@readOnly` | `readOnlyHint` | The tool does not change anything. Hosts can run it without asking. |
| `@destructive` | `destructiveHint` | The tool may delete or overwrite data (the default assumption when it is not read-only). `@destructive false` says it only adds. |
| `@idempotent` | `idempotentHint` | Calling it again with the same input has no further effect. |
| `@openWorld` | `openWorldHint` | The tool reaches outside the plugin's own data, e.g. the open internet. `@openWorld false` says it does not. |

A tag without a value means true; `false` sets the hint to false; anything else is ignored. The hints are advertised
in `tools/list` as `annotations`. They are hints: how a host reacts (for example by asking only for the tools that
are not read-only) is up to the host, and a host never has to trust them.

```ts
/**
 * Lists the invoices of a customer.
 * @readOnly
 */
async listInvoices(input: ListInvoicesInput): Promise<InvoiceList> { … }

/**
 * Replaces the due date of an invoice.
 * @idempotent
 */
async setDueDate(input: SetDueDateInput): Promise<Invoice> { … }
```

Mark every tool that only reads as `@readOnly`; leave the tools that write without a tag or give them the hints
that fit.

## Practical tips

- Write a JSDoc description for **every** method and property — descriptions are the main thing
  the agent reads when deciding how to call your tool.
- Use string literal unions (`"fi" | "sv" | "en"`) for closed value sets — they become `enum`s
  the agent cannot get wrong.
- Export the types of tool inputs and outputs from `src/tools/mod.ts` (see
  [Where the types live](#where-the-types-live)) and look at the generated schema once: an empty `{}` means that a
  type was not resolved.
- Mark truly optional properties with `?` — everything else becomes `required` in the input
  schema.
- Use `@example` on non-obvious properties; agents follow examples closely.
- Mark tools that only read with `@readOnly`, so hosts do not ask the user to approve every call.
- Keep the model's tool list small: mark widget-only helpers with `@visibility app`.
