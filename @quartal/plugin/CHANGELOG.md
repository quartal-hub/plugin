# @quartal/plugin

## 0.5.2

### Patch Changes

- 844f6df: Readme images updated

## 0.5.1

### Patch Changes

- 3922e86: Remove leftovers from the project's Deno/JSR era.
  
  `@quartal/plugin-core` drops `deno.jsonc` and is now a plain pnpm TypeScript package. Its README
  documents that the package has, and must keep, no runtime dependencies: it sits at the bottom of the
  dependency graph for every other `@quartal` package and is consumed from server, browser, and
  bundler contexts alike.
  
  Documentation and comments across the other packages no longer describe the Deno-era toolchain.
  Published READMEs are affected, hence the version bumps; there are no code changes.
- 3922e86: Regenerate the package README from the docs vault: adds the Prompts artifact type and Agents to the
  artifact lists, links the plugin template repository, and replaces the header image with a cropped
  version. Removes a duplicated Getting Started section.
- Updated dependencies [3922e86]
  - @quartal/plugin-core@0.5.1
