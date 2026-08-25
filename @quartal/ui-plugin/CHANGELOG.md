# @quartal/ui-plugin

## 0.6.1

### Patch Changes

- 3922e86: Remove leftovers from the project's Deno/JSR era.
  
  `@quartal/plugin-core` drops `deno.jsonc` and is now a plain pnpm TypeScript package. Its README
  documents that the package has, and must keep, no runtime dependencies: it sits at the bottom of the
  dependency graph for every other `@quartal` package and is consumed from server, browser, and
  bundler contexts alike.
  
  Documentation and comments across the other packages no longer describe the Deno-era toolchain.
  Published READMEs are affected, hence the version bumps; there are no code changes.

## 0.6.0

### Minor Changes

- da3bb93: Move `vue` and `vue-router` from `dependencies` to `peerDependencies`.
  
  Both are rollup externals in the library build, so the published bundle imports
  them rather than embedding them. Declaring them as runtime dependencies gave
  consumers a second copy of each, which breaks the things that depend on a single
  shared instance: Vue reactivity across the component boundary, and `vue-router`'s
  `inject` keys behind `useRoute()` and `RouterLink`.
  
  Consumers already using this package with Vue 3.5+ and vue-router 4.6+ need no
  change; the packages they were installing transitively are now peers they supply.
