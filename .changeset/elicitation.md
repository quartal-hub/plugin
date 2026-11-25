---
"@quartal/plugin": major
"@quartal/plugin-core": minor
---

Asking the user mid-call (MCP elicitation).

- `@quartal/plugin/elicit`: `elicitForm<T>(ctx, key, { message })` asks with a form and `elicitUrl(ctx, key, { message, url })` asks the user to open a page. Both are stateless (MCP 2026-07-28 input-required results): the client retries the call with the answer and the method runs again.
- The code generator builds the form schema from `T` (flat object of strings, numbers, booleans, string-literal unions and arrays of one; JSDoc becomes the label) into `elicitations` on the tool descriptor, and fails the build for a type a form cannot express.
- A client without elicitation, or a 2025-era client, gets the fallback: `decline` by default, or an error with `fallback: "error"`.
- REST: with `Qrtl-Elicitation: form|url`, a tool that asks answers HTTP 428 with `inputRequests`; the retry carries the answers in `Qrtl-Input-Responses` (base64url JSON). `open-api.json` documents the 428.
- Every tool method now receives a context as its second parameter, also without authentication (`{ authenticated: false }`).
- `@quartal/plugin-core`: `CodeElicitation`, `CodeFunction.elicitations` and `McpToolDescriptor.elicitations`.
