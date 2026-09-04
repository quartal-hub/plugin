# Schemas: what the agent sees

When you write a tool class in `tools/`, `@quartal/plugin` analyzes your TypeScript and JSDoc and generates JSON Schemas for the MCP server (`tools/list`) and the OpenAPI document. This page explains what ends up in those schemas — so you know exactly what an AI agent (or an MCP client such as MCPJam or Claude) sees, without reading the generator internals.

## Tool metadata

| Schema field | Comes from | Notes |
|---|---|---|
| `name` | Method name | Prefixed with the class name (`Class_method`) only when the same method name exists in two classes. Characters outside `a–z A–Z 0–9 _ -` are replaced with `_`. |
| `title` | `@summary` JSDoc tag on the method | Optional short display name. |
| `description` | JSDoc body of the method | The full comment text above the tags; paragraphs are kept. |
| `inputSchema` | The method's **first parameter** | See below. Any further parameters are treated as injected context (auth, request, …) and never appear in the schema. |
| `outputSchema` | The method's return type | `Promise<T>` is unwrapped to `T`. See below. |
| `_meta.ui.visibility` | `@visibility` JSDoc tag on the method | MCP Apps visibility scopes: `model` (callable by the agent) and/or `app` (callable by this plugin's widgets only), space- or comma-separated. Unknown words are ignored; omitted = host default `["model", "app"]`. |

## Input schema

Design your tool method to take a single input object — its properties become the schema properties directly (the object is "unwrapped", there is no extra nesting level).

### TypeScript → JSON Schema

| You write | Agent sees |
|---|---|
| `string`, `number`, `boolean` | `{ "type": "string" \| "number" \| "boolean" }` |
| `Foo[]`, `Array<Foo>` | `{ "type": "array", "items": … }` |
| Named interface / type alias | Inlined object schema with all its properties; `extends` chains are flattened in. |
| `"a" \| "b" \| "c"` (string literal union, inline or as a type alias) | `{ "type": "string", "enum": ["a", "b", "c"] }` |
| Other unions (`Foo \| Bar`) | `{ "oneOf": [ …, … ] }` |
| `name?: string` (optional) | Property present, but omitted from `required`. |
| `string \| null` | Treated as `string`; the property is still required unless also optional. |
| `any`, `unknown`, unresolvable types | `{}` (anything allowed) |
| `object`, `Record<string, …>` | `{ "type": "object", "additionalProperties": true }` |
| Recursive types (a tree node referencing itself) | The nested occurrence becomes an open object — recursion is cut, not followed. |

### JSDoc → JSON Schema

| You write | Agent sees |
|---|---|
| JSDoc body on a property | `description` |
| `@summary` on a property | `title` |
| `@format date` (string properties only) | `format` — e.g. `date`, `date-time`, `time`, `duration`, `email`, `uri`, `uri-reference`, `uuid` |
| `@example { … }` | `example` — parsed as JSON when possible, otherwise kept as text |
| `@param input …` on the method | `description` of the input object itself |

Input schemas are **strict**: `additionalProperties: false` and every non-optional property is listed in `required`. This is intentional — the agent constructs the input, and a strict schema steers it to the exact shape your method expects.

## Output schema

The return type produces the tool's `outputSchema`, and every successful call returns the result twice, as the MCP spec recommends:

- `structuredContent` — the result object itself (first, so it is what you see when inspecting raw results).
- A `text` content block with the same JSON serialized — for older clients that only read text.

### Wrapping

A tool result is always a JSON **object**. If your method returns a primitive or an array, the runtime wraps it — and the schema reflects that:

| Return type | Runtime result | Output schema shape |
|---|---|---|
| `Calculation` (object type) | The object as-is | Object schema with its properties |
| `number` / `string` / `boolean` / array | `{ "value": 5 }` | `{ "value": … }` |
| `void` / `undefined` | `{}` | Empty object |
| Unresolvable type | The object as-is | No `outputSchema` advertised |

`@returns` JSDoc text becomes the output schema's `description`.

### Relaxations — why the output schema is looser than the input

MCP clients **validate** `structuredContent` against the advertised `outputSchema` and reject the whole tool result on any mismatch. Real-world results (especially from upstream APIs) routinely contain explicit `null` values and extra fields that TypeScript typings don't declare. So output schemas keep their documentation value but drop every constraint that could reject a legitimate result:

| Rule | Input schema | Output schema |
|---|---|---|
| Extra properties | `additionalProperties: false` | `additionalProperties: true` |
| Required properties | Non-optional properties listed in `required` | No `required` at all |
| Nullability | `string` stays `string` | Every type widened: `["string", "null"]`, `["object", "null"]`, … |
| Enums | `enum: ["a", "b"]` | `null` added: `enum: ["a", "b", null]` |

In short: the input schema is a contract the agent must fulfill; the output schema is documentation of what the agent can expect.

## Prompts

Classes in `prompts/` work like tool classes: each method becomes an MCP prompt, the method's JSDoc body its description, `@summary` its title, and the properties of the single input object its arguments.

**Important: prompt arguments have no types.** The MCP protocol defines prompt arguments as plain strings, so only four things survive from your TypeScript:

- `name` — the property name
- `title` — from `@summary`
- `description` — from the property JSDoc
- `required` — from the property being non-optional

Even if you type an argument as `number` or `boolean`, the value **arrives as a string at runtime** (`"42"`, `"true"`). Type prompt arguments as `string` and parse them in your prompt method — a `number`-typed argument would silently hold a string.

## Practical tips

- Write a JSDoc description for **every** property — descriptions are the main thing the agent reads when deciding how to call your tool.
- Use `@example` on non-obvious properties; agents follow examples closely.
- Use string literal unions (`"fi" | "sv" | "en"`) for closed value sets — they become `enum`s the agent cannot get wrong.
- Mark truly optional properties with `?` — everything else becomes `required` in the input schema.
- Don't rely on the output schema for strict result typing in your own client code; it is deliberately permissive.
