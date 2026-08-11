# @quartal/plugin

The npm home of the Quartal Plugin framework.

It ships the build-time **analysis + schema layer**: it analyzes a projects's `tools/*.ts` + JSDoc and
produces the `qrtl-plugin/*.json` metadata (tools, types, OpenAPI, MCP tools/catalog), plus the
`generateTools` orchestration (the Vite codegen plugin), the Hono runtime app, and the `qrtlPlugin()`
Astro integration.

```bash
npm install
npm run build      # tsc → dist/ (.js + .d.ts)
npm test           # vitest
```

## Type introspection engine

`TsMorphAnalyzer` (`src/code/TsMorphAnalyzer.ts`) analyzes the projects's `tools/` sources with the
TypeScript compiler via **[ts-morph](https://ts-morph.com)** and emits the `CodeFile[]` model that
every downstream builder consumes. The type checker resolves the import graph natively, so imported
(e.g. `@salaxy/core`) types are pulled into a synthetic `imported-types.ts` closure with no custom
WASM engine and no JSR dependency.

`ts-morph` is a **build-time** dependency: `generateTools` imports it lazily, so merely importing
`@quartal/plugin` at runtime never pulls it into the deployed server graph — codegen only runs at build
time. (This replaces the former `@deno/doc` WASM engine + deno-doc "V2" JSON format.)

## Notes on the port

- Sources keep Deno-style explicit `.ts` import extensions; `tsc` (`rewriteRelativeImportExtensions`)
  rewrites them to `.js` on emit.
- Shared types come from the published `@quartal/plugin-core`.
- Deno APIs were swapped for Node equivalents (`@std/*`→`node:*`, `Deno.readTextFile`/`writeTextFile`/
  `mkdir`/`stat`/`realPathSync`→`node:fs`). No Deno runtime is required.
