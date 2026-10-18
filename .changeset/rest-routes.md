---
"@quartal/plugin-core": minor
"@quartal/plugin": minor
"@quartal/create-plugin": patch
"@quartal/ui-plugin": patch
---

REST routes follow REST conventions instead of `POST /api/<Class>/<method>`. The route of a tool is
`/api/<class>[/<segment>][/{id}]`: the class name in kebab-case, the HTTP method and segment from the
leading verb of the method name (`get`/`list`/`find` → GET, `create` → POST, `update`/`replace` → PUT,
`delete`/`remove` → DELETE, anything else → POST at its full name), and `{id}` for GET/PUT/DELETE when
the input has a required primitive `id`. `Invoices.get({ id })` is `GET /api/invoices/{id}`,
`HelloWorld.sayHello` is `POST /api/hello-world/say-hello`. A `@rest` JSDoc tag overrides the
convention: `@rest invoicing` on a class sets the class path; `@rest [METHOD] [path]` on a method sets
the method and/or path (a relative path is appended to the class path; a path starting with `/` is the
full path and must start with `/api`; path parameters are written `{name}`). Path parameters and, for GET and DELETE,
the query string carry the input properties; POST and PUT take the rest as the JSON body. GET/DELETE
inputs and path parameters must be `string`, `number` or `boolean`, otherwise the build fails with a
message pointing at `@rest POST`. The `defaultMethod` option of `generateTools` / `buildPluginArtifacts`
is gone, `PluginToolExposure.restMethod` is upper-case (`"GET" | "POST" | "PUT" | "DELETE"`), and
`CodeFunction.rest` / `CodeClass.rest` carry the declared tags. MCP tool names and schemas are unchanged.

The same verbs shape the MCP side: a bare CRUD verb is completed with the class noun for the MCP tool
name (`Invoices.get` → `getInvoice`, `Invoices.list` → `listInvoices`; a name two classes share is
prefixed with the class on both), and the verb implies the tool annotations unless `@readOnly` & co. say
otherwise (`get`/`list`/`find` read-only, `create` not destructive, `update` idempotent, `delete`/`remove`
destructive and idempotent).

A tool can be kept to one surface: `@rest hidden` (method or class) gives it no REST operation,
`@mcp hidden` (method or class) leaves it out of the MCP server (`CodeFunction.mcp` / `CodeClass.mcp`).
