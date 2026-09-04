# @quartal/plugin-core

## 0.6.1

### Patch Changes

- 97dc6c5: Baseline release of every published package to verify the upgraded release pipeline
  (changesets/action v2) pushes git tags and creates GitHub Releases on publish.

## 0.6.0

### Minor Changes

- e4c8a90: Add the `@visibility` JSDoc tag for tools (MCP Apps `_meta.ui.visibility`): `model` and/or `app`
  scopes, advertised in `tools/list` so hosts can hide widget-only helper tools from the model.
  New `McpToolVisibility` type and optional `visibility` on `McpToolDescriptor` / `CodeFunction`.

## 0.5.1

### Patch Changes

- 3922e86: Remove leftovers from the project's Deno/JSR era.
  
  `@quartal/plugin-core` drops `deno.jsonc` and is now a plain pnpm TypeScript package. Its README
  documents that the package has, and must keep, no runtime dependencies: it sits at the bottom of the
  dependency graph for every other `@quartal` package and is consumed from server, browser, and
  bundler contexts alike.
  
  Documentation and comments across the other packages no longer describe the Deno-era toolchain.
  Published READMEs are affected, hence the version bumps; there are no code changes.
