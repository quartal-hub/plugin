# @quartal/ui-plugin

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
