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

## How a release happens

1. Changesets accumulate on `main` as PRs merge.
2. The `release` workflow opens (and keeps updating) a **"Version Packages"** PR
   that consumes them: bumps versions, rewrites internal dependency ranges, and
   writes changelogs.
3. Merging that PR publishes the packages to npm and pushes git tags.

Nothing is published from `main` until that PR is merged, so `main` stays
releasable without being released.
