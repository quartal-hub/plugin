# @quartal/create-plugin

## 0.8.0

### Minor Changes

- 8b460f9: Scaffolded plugins now use `auth: "quartal-hub"` and depend on `@quartal/plugin@^0.8.0` / `@quartal/plugin-core@^0.7.0` — the previously published scaffolder still emitted `^0.6.0` ranges.

## 0.7.0

### Minor Changes

- aed3d80: Non-interactive scaffolding for CI and coding agents: every starter-kit question now has a CLI
  flag (`--description`, `--auth`/`--no-auth`, `--sample-tool`/`--no-sample-tool`, `--widgets`),
  `--yes` accepts the defaults for the rest, and `--help` prints the usage. Scaffolded projects
  now include an `AGENTS.md` that briefs coding agents on the project conventions.

### Patch Changes

- aed3d80: Scaffolded projects configure the auth mode only in `qrtl.config.ts`; the generated
  `astro.config.mjs` uses the bare `qrtlPlugin()` integration.

## 0.6.1

### Patch Changes

- 97dc6c5: Baseline release of every published package to verify the upgraded release pipeline
  (changesets/action v2) pushes git tags and creates GitHub Releases on publish.

## 0.6.0

### Minor Changes

- 132e89d: New `@quartal/create-plugin` starter kit: `pnpm create @quartal/plugin` scaffolds a plugin project,
  asking for name, description, Quartal Hub authentication (OAuth2 vs `anon`), a sample
  tool, and a widget framework (None / Vue / React / Plain JavaScript).
