# Changesets

This folder holds [changesets](https://github.com/changesets/changesets): small
markdown files describing pending releases for the packages under `@quartal/`.

## Adding a changeset

Run this in any PR that changes a published package:

```bash
pnpm changeset
```

Pick the affected packages, pick `patch` / `minor` / `major`, and write a one-line
summary. The summary lands verbatim in the package's `CHANGELOG.md`, so write it
for a consumer of the package, not for a reviewer of the diff.

Commit the generated file in `.changeset/` along with your changes.

If the release will bump `@quartal/plugin`, `@quartal/plugin-core`, or `@quartal/plugin-vue`, also
update `@quartal/create-plugin/src/dependencyVersions.ts` to the new ranges and add a
`@quartal/create-plugin` changeset: the Version Packages PR rewrites internal dependency ranges in
`package.json` files only, not the ranges the scaffolder writes into new projects.

## Versioning

Every package has its own version. A bump applies only to the packages whose changesets name
it (the default changesets behaviour: `config.json` has no `fixed` or `linked` group), so a major
in one package does not move the others. `@quartal/plugin` can go to 2.0 over a change in the
widget runtime while `@quartal/plugin-core` stays on 1.x.

What keeps the packages compatible is their dependency ranges, not a shared number:
`@quartal/plugin` depends on `@quartal/plugin-core` and `@quartal/plugin-embed`,
`@quartal/plugin-vue` and `@quartal/ui-plugin` depend on them in turn, and the Version Packages PR
rewrites every internal `workspace:*` range to the released version. A plugin author installs the
ranges `@quartal/create-plugin` wrote into the project and upgrades each package on its own
schedule; the ranges say which versions work together.

The 1.0.0 release moved every package to the same number at once. That was a one-time alignment,
not a rule.

## How a release happens

1. Changesets accumulate on `main` as PRs merge.
2. The `release` workflow opens (and keeps updating) a **"Version Packages"** PR
   that consumes them: bumps versions, rewrites internal dependency ranges, and
   writes changelogs.
3. Merging that PR publishes the packages to npm and pushes git tags.

Nothing is published from `main` until that PR is merged, so `main` stays
releasable without being released.
