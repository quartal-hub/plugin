# Plan: REST-native paths and HTTP methods

Status: implemented in `@quartal/plugin` (`code/parseRestTag.ts`, `code/resolveRestRoutes.ts`); the user-facing description is the "REST routes" section of the Tools guide. Scope: the OpenAPI/REST surface only. MCP tool ids, input schemas
and `tools/list` are untouched. Everything stays under the one base path `/api`; other roots can
become configuration later.

## Today

- Every tool method is one REST operation at `POST <basePath>/<Class>/<method>` with the whole
  input object as the JSON body (`registerOpenApiRoutes.ts`). A `defaultMethod: "get"` option
  exists in `generateTools` / `PluginApiHelper` but nothing user-facing sets it, so every plugin
  is POST-only.
- The same `basePath/Class/method` string is built a second time in `buildPluginInfo.ts` for
  `contents.json` (`exposure.restUrl` / `restMethod`), which the docs SPA shows as a badge.
- JSDoc tags on methods are read in `TsMorphAnalyzer.ts` (`summaryTag`, `visibilityTag`,
  `annotationTags`) into `CodeFunction`; `@readOnly` and friends are the newest and the pattern to
  follow. Class-level JSDoc is read only for the description.
- `@hono/zod-openapi` already turns an OpenAPI `{id}` path into a Hono `:id` route, so path
  parameters need no routing work, only schema work.

## Target behaviour

A route is resolved per method in three layers, each overriding the previous one:

1. **Convention** from the class name and the method name (no tags at all).
2. **Class tag** `@rest /path` sets the class path.
3. **Method tag** `@rest [METHOD] [path]` sets the method, the path, or both.

### Route shape

```
/api/<class path>[/<segment>][/{id}]
```

- **Class path**: kebab-case of the class name (`HelloWorld` → `hello-world`), or the class
  `@rest` path.
- **Segment**: from the method name, see the convention below; may be empty.
- Parameter names (query, body, path) stay exactly as declared in TypeScript (camelCase).
- Kebab rules: `-` at lower→upper and upper→upper+lower boundaries, lowercase, `_` → `-`
  (`getHTTPStatus` → `get-http-status`, `v2_report` → `v2-report`).

### Naming convention (no tags)

The method name's leading verb picks the HTTP method and the path shape. The verb must be
followed by an upper-case letter, a digit, `_` or the end of the name (`listen` is not `list`).

| Leading verb | HTTP | Path | Input placement |
|---|---|---|---|
| `get` | GET | `<class>[/<rest>][/{id}]` | `{id}` from the path, the rest as query |
| `list`, `find` | GET | `<class>[/<rest>]` | query |
| `create`, `post` | POST | `<class>[/<rest>]` | JSON body |
| `update`, `replace`, `put` | PUT | `<class>[/<rest>][/{id}]` | `{id}` from the path, the rest as body |
| `delete`, `remove` | DELETE | `<class>[/<rest>][/{id}]` | `{id}` from the path, the rest as query |
| anything else (`search`, `calculate`, `sayHello`, …) | POST | `<class>/<kebab(full name)>` | JSON body |

- `<rest>` is the kebab-cased remainder of the name after the verb. It is **dropped when it names
  the class** (equal to the class name, or to the class name without a trailing `s`,
  case-insensitive): `Invoices.listInvoices` → `GET /api/invoices`, `Invoices.getInvoice` →
  `GET /api/invoices/{id}`. No other pluralisation is attempted.
- `{id}` is added for GET, PUT and DELETE when the input object has a **required** primitive
  property named `id`, or when the name ends in `ById` (`findById`, `deleteById`; the suffix is
  dropped from the path). An optional `id` stays a query parameter; nothing else is ever promoted
  to the path by convention.
- Standard verbs map onto the resource; unrecognised verbs are **custom methods** and keep their
  full name as a segment, always POST. `search` is deliberately a custom method: searches tend to
  carry structured filters that a GET query cannot express.
- `patch` is not a verb: PATCH is unsupported, so `patchX` is a custom method (POST).

A plain CRUD class therefore needs no tags:

```ts
export class Invoices {
  list(input: { page?: number })            // GET    /api/invoices?page=
  get(input: { id: string })                // GET    /api/invoices/{id}
  create(input: NewInvoice)                 // POST   /api/invoices
  update(input: { id: string } & Fields)    // PUT    /api/invoices/{id}   (body: Fields)
  delete(input: { id: string })             // DELETE /api/invoices/{id}
  approve(input: { id: string })            // POST   /api/invoices/approve  (body: { id })
}
```

Comparable frameworks the convention is taken from:

- **ASP.NET Web API**: the action name's leading verb (`Get*`, `Post*`, `Put*`, `Delete*`)
  selects the HTTP method, anything else is POST; the controller name is the route.
- **Google API design guide (AIP-131…135)**: the standard methods `Get`, `List`, `Create`,
  `Update`, `Delete` with fixed path shapes (`GET collection`, `GET collection/{id}`,
  `POST collection`, `… /{id}`); AIP-136 custom methods get their own verb in the URL and use POST.
- **Feathers / LoopBack 4** (Node): `find`, `get`, `create`, `update`, `remove`,
  `findById` / `replaceById` / `deleteById`.

### `@rest` tag on a class

```
/** @rest /invoicing */
export class InvoiceTools { … }
```

- A path only; a leading `/` is optional and normalised. A method word in a class tag is a build
  error. Replaces the kebab-cased class name in every route of the class.
- The class path may carry parameters (`@rest /companies/{businessId}`); each method's input
  must then contain that property under the same rules as any other path parameter.

### `@rest` tag on a method

```
@rest [METHOD] [path]
@rest path
```

| Tag (on `Invoices.purgeOld`) | Result |
|---|---|
| `@rest DELETE` | `DELETE /api/invoices/purge-old` (method from the tag, path by convention; `{id}` rule applies) |
| `@rest DELETE old` | `DELETE /api/invoices/old` (relative: appended to the class path) |
| `@rest DELETE /maintenance/old` | `DELETE /api/maintenance/old` (leading `/`: relative to `/api`, ignores the class path) |
| `@rest old/{year}` | `POST /api/invoices/old/{year}` (path only, method by convention) |
| `@rest PATCH` or `@rest FETCH /x` | build error: unsupported method, lists GET, POST, PUT, DELETE |

- Methods: `GET`, `POST`, `PUT`, `DELETE`. Matching is case-insensitive, stored upper-case. Method and
  path are separated by whitespace, the way an HTTP request line or a README writes an endpoint
  (`DELETE /invoices/{id}`); the first token is the method only when it is one of these words.
- An explicit path is used verbatim: no segment from the name, no automatic `{id}`. Path
  parameters are written as `{name}` and must be properties of the input object.
- Duplicate `(method, path)` pairs across the plugin fail the build, naming both methods.

### Where the input goes

| Method | Path params | Rest of the input |
|---|---|---|
| GET, DELETE | `request.params` | `request.query` (all remaining properties) |
| POST, PUT | `request.params` | `request.body` as `application/json` (remaining properties); no body when nothing remains |

Path parameters are removed from the body/query schema so a property never appears twice.

### Type restrictions (fail the build with a clear message)

- A path parameter must be a required, non-nullable `string`, `number` or `boolean` (a
  string-literal union / enum alias counts as string).
- In GET and DELETE every remaining input property must be `string`, `number` or `boolean`
  (optional allowed, `null` not allowed, no arrays, no objects, no `Date`). The message names the
  property and suggests `@rest POST` for anything richer.
- Methods with no input (no parameter, or `void` / `null` / `undefined` / `any`) produce an
  operation without query or body.
- Query and path values are strings on the wire; `ZodBuilder` builds a second input schema
  (`FunctionZodDefinition.inputFromText`) whose `number` and `boolean` properties also accept
  their text form (`42`, `true`, `false`, `1`, `0`); it is built before descriptions and examples
  are attached, so the OpenAPI document keeps them. Empty string → `undefined` for optional
  query params.

Nothing else from OpenAPI is in scope: no headers, cookies, PATCH, multiple response codes,
content types other than JSON.

### Effect on the samples

All existing `get*` / `find*` / `list*` methods take primitives or nothing, so no sample breaks:

| Method | Route today | Route after |
|---|---|---|
| `Companies.findCompanies({ name?, businessId? })` | `POST /api/Companies/findCompanies` | `GET /api/companies?name=&businessId=` |
| `Companies.searchCompanies({ query, lang? })` | `POST /api/Companies/searchCompanies` | `POST /api/companies/search-companies` |
| `CompanyOverview.getCompanyOverview({ businessId, lang? })` | `POST /api/CompanyOverview/getCompanyOverview` | `GET /api/company-overview?businessId=&lang=` |
| `Financials.listFilers({ … })` | `POST /api/Financials/listFilers` | `GET /api/financials/filers?…` |
| `SalaxyTools.getSession(void)` | `POST /api/SalaxyTools/getSession` | `GET /api/salaxy-tools/session` |
| `Calculator.add({ first, second })` | `POST /api/Calculator/add` | `POST /api/calculator/add` |

## Implementation

### 1. Model (`@quartal/plugin-core`)

- `CodeFunction.rest?: { method?: "GET" | "POST" | "PUT" | "DELETE"; path?: string }` — the raw
  method tag, only present when declared.
- `CodeClass.rest?: { path: string }` — the raw class tag.
- `PluginToolExposure.restMethod` narrows to `"GET" | "POST" | "PUT" | "DELETE"` (drop `patch`,
  no backward compatibility).
- New `RestRoute` type `{ method, path, pathParams: string[] }` in `model/code-file/` for the
  resolved route, used by every REST-side consumer.

### 2. Analyzer (`TsMorphAnalyzer.ts`)

- `restTag(node)` next to `annotationTags`: parse `@rest`, split on whitespace, take a leading method word; trim
  sides, validate the method word; a class tag rejects a method word. Throws `Error` with
  `Class.method: @rest …` context. Sets `fn.rest` / `cls.rest`.
- Test file `test/restTag.test.ts` modelled on `toolAnnotations.test.ts`.

### 3. Route resolution (new `code/resolveRestRoutes.ts` in `@quartal/plugin`)

- `toKebabCase(name)`, `splitLeadingVerb(name)`, `resolveRestRoute(cls, fn, inputProps,
  basePath): RestRoute` implementing the three layers above.
- Validates path params and the GET/DELETE primitive rule against the resolved input type
  (`buildTypeIndex`), so a referenced interface from `src/tools/model/` is checked the same as an
  inline object.
- `resolveRestRoutes(codeFiles, basePath)` returns `Map<"Class.method", RestRoute>` and throws on
  duplicate routes. Called once in `buildPluginArtifacts` (build) and once in
  `PluginApiHelper.prepareTools` (runtime fallback); both pass the result on.
- Unit tests for the convention table, the class-name drop rule, the `ById` suffix, the `{id}`
  promotion and the collision error, independent of Hono.

### 4. OpenAPI + runtime (`registerOpenApiRoutes.ts`, `PluginApiHelper.ts`,
`buildOpenApiDocument.ts`)

- `registerOpenApiRoutes` takes the route map; per definition it builds `request.params`
  (coerced primitive object), `request.query` (coerced, GET/DELETE) or `request.body`
  (POST/PUT), takes `method` and `path` from the route.
- The handler merges `c.req.valid("param")`, `valid("query")` and `valid("json")` (whichever the
  route declares) into the single input object before `execute()`.
- Remove the `defaultMethod` option everywhere (`generateTools`, `buildPluginArtifacts`,
  `buildOpenApiDocument`, `RegisterOpenApiRoutesOptions`, `PluginApiHelper.defaultMethod`,
  `BuildPluginInfoInput.defaultMethod`). The per-method route replaces it.
- `ZodBuilder.paramsToZod(parameters, fromText)` produces `inputFromText`; the old post-hoc
  `coerceQuerySchema.ts` is gone (wrapping a schema after `.openapi()` loses its metadata and
  renders `z.coerce.*` as optional and nullable).

### 5. Plugin overview (`buildPluginInfo.ts`)

- `exposure.restUrl` / `restMethod` come from the route map, not from string concatenation.

### 6. Tests

- `test/restRoutes.test.ts` (end to end through `app.request`): convention routes for a CRUD
  class, class tag, relative and absolute method tags, spaced tag, path-only tag, path param bound
  and coerced, GET query, DELETE with `{id}` and nothing else, PUT body excludes `{id}`, 422 on a
  bad query type, build errors for unsupported method, method word on a class, unknown `{param}`,
  optional path param, object property in GET, duplicate route.
- Update existing path assertions (`servingApp`, `getAnonApp`, `artifactsInjection`,
  `astroIntegration`, `buildPluginArtifacts`) to the new paths.
- `samples/test1`: add an `Invoices` class like the example above plus one tagged method, so the
  golden artifacts in `test/fixtures/pkg/qrtl-plugin/*.json` cover the feature; regenerate the
  committed fixtures (`golden.test.ts` compares byte-exact modulo key order).

### 7. Docs and text that pins the old shape

- `website/src/content/docs/tools/creating-tools.md`: `@rest` in the method tag table, new
  "REST routes" page or section (route shape, convention table with the framework note, class and
  method tags, path params, restrictions), update the `POST /api/HelloWorld/sayHello` example.
- `website/src/content/docs/reference/http-endpoints.md` REST table,
  `reference/plugin-outputs.md`, `getting-started.md`.
- `docs/schema-generation.md` if it mentions the REST path.
- `@quartal/create-plugin/src/scaffoldProject.ts` scaffold README text; `samples/salaxy-auth/README.md`.
- `@quartal/ui-plugin/src/fixtures/samplePlugin.ts` REST badges.
- `README.md` at the root and `@quartal/plugin/README.md` are generated from the docs repo: leave
  them, note the change for the docs repo.
- Changeset: `minor` for `@quartal/plugin` and `@quartal/plugin-core`, `patch` for
  `@quartal/create-plugin` and `@quartal/ui-plugin`.

## Open decisions

1. A `get*` / `list*` / `find*` / `delete*` method whose input does not fit GET/DELETE: fail the
   build with a hint to add `@rest POST` (planned, deterministic from the name) vs. silently fall
   back to POST (predictable only after reading the schema).
2. Whether `@rest` or the convention should also set the MCP `readOnlyHint` for GET (planned:
   no, the two surfaces stay independent; `@readOnly` is explicit).
