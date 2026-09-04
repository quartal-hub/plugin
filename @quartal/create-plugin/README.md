# @quartal/create-plugin

The starter kit for [Quartal Plugins](https://plugin.quartal.com). Scaffolds a new plugin project —
an [Astro](https://astro.build) app with the `qrtlPlugin()` integration serving MCP, OpenAPI/REST,
widgets and Agent Skills.

## Usage

```bash
pnpm create @quartal/plugin
```

```bash
npm create @quartal/plugin
```

Optionally pass the project name directly: `pnpm create @quartal/plugin my-plugin`.

The starter kit asks for:

- **Name** — the npm package / directory name (required).
- **Description** — optional one-liner.
- **Quartal Hub authentication** — yes/no. Yes scaffolds OAuth2 with the default Quartal auth
  (`auth: "quartal-iam"`); no scaffolds an anonymous plugin (`auth: "anon"`).
- **Sample tool** — yes/no (default yes): a `HelloWorld` class under `src/tools/`.
- **Widgets** — None / Vue (default) / React / Plain JavaScript: a `sayHello` widget page under
  `src/pages/widgets/`.

Then:

```bash
cd my-plugin
pnpm install
pnpm dev
```

See [Getting started](https://plugin.quartal.com) for what runs on `http://localhost:4321` and how
to make the plugin your own.

## How it works

Static files are copied from [`templates/`](./templates/); the option-dependent files
(`package.json`, `qrtl.config.ts`, `astro.config.mjs`, `README.md`, `src/tools/mod.ts`) are
generated in [`src/scaffoldProject.ts`](./src/scaffoldProject.ts). Dependency versions written into
the scaffolded `package.json` are pinned in
[`src/dependencyVersions.ts`](./src/dependencyVersions.ts) — bump them there when the workspace
packages release.
