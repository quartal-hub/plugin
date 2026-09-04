# @quartal/create-plugin

## 0.6.1

### Patch Changes

- 97dc6c5: Baseline release of every published package to verify the upgraded release pipeline
  (changesets/action v2) pushes git tags and creates GitHub Releases on publish.

## 0.6.0

### Minor Changes

- 132e89d: New `@quartal/create-plugin` starter kit: `pnpm create @quartal/plugin` scaffolds a plugin project,
  asking for name, description, Quartal Hub authentication (OAuth2 `quartal-iam` vs `anon`), a sample
  tool, and a widget framework (None / Vue / React / Plain JavaScript).
