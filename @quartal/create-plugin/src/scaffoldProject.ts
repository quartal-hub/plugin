import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CreatePluginOptions } from "./CreatePluginOptions.ts";
import { DEPENDENCY_VERSIONS } from "./dependencyVersions.ts";

/** The `templates/` directory shipped alongside `dist/` in the published package. */
const TEMPLATES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../templates");

/** The unscoped part of a (possibly scoped) package name — used as the target directory name. */
export function unscopedName(name: string): string {
  return name.replace(/^@[^/]+\//, "");
}

/** Derives a human-readable title from a package name: `@org/my-plugin` → `My Plugin`. */
export function titleFromName(name: string): string {
  return unscopedName(name)
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Scaffolds a new Quartal Plugin project into `<cwd>/<unscoped name>` from the answered options:
 * copies the static template files and generates the option-dependent ones (`package.json`,
 * `qrtl.config.ts`, `astro.config.mjs`, `README.md`, `AGENTS.md`, `src/tools/mod.ts`).
 * @param options Answered prompts.
 * @param cwd Directory the project directory is created under.
 * @returns The absolute path of the created project directory.
 */
export async function scaffoldProject(options: CreatePluginOptions, cwd: string): Promise<string> {
  const dir = join(cwd, unscopedName(options.name));
  if (existsSync(dir) && (await readdir(dir)).length > 0) {
    throw new Error(`Directory ${dir} already exists and is not empty.`);
  }

  const write = async (relPath: string, content: string) => {
    const target = join(dir, relPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  };
  const copy = async (templatePath: string, relPath: string) => {
    const target = join(dir, relPath);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(TEMPLATES_DIR, templatePath), target);
  };

  // npm strips `.gitignore` from published packages, hence the `_gitignore` template name.
  await copy("base/_gitignore", ".gitignore");
  await copy("base/tsconfig.json", "tsconfig.json");
  await write("public/.gitkeep", "");
  await write("package.json", renderPackageJson(options));
  await write("qrtl.config.ts", renderQrtlConfig(options));
  await write("astro.config.mjs", renderAstroConfig(options));
  await write("README.md", renderReadme(options));
  await write("AGENTS.md", renderAgentsMd(options));
  await write("src/tools/mod.ts", renderToolsMod(options));

  if (options.sampleTool) {
    await copy(options.auth ? "tools/HelloWorld.auth.ts" : "tools/HelloWorld.anon.ts", "src/tools/HelloWorld.ts");
  }
  if (options.widgets !== "none") {
    await copy("widgets/WidgetLayout.astro", "src/layouts/WidgetLayout.astro");
    await copy(`widgets/${options.widgets}/sayHello.astro`, "src/pages/widgets/sayHello.astro");
    if (options.widgets === "vue") await copy("widgets/vue/SayHello.vue", "src/components/SayHello.vue");
    if (options.widgets === "react") await copy("widgets/react/SayHello.tsx", "src/components/SayHello.tsx");
  }

  return dir;
}

/** Renders the project `package.json` with only the dependencies the chosen options need. */
function renderPackageJson(options: CreatePluginOptions): string {
  const dependencies: Record<string, string> = {
    "@astrojs/node": DEPENDENCY_VERSIONS["@astrojs/node"],
    "@quartal/plugin": DEPENDENCY_VERSIONS["@quartal/plugin"],
    astro: DEPENDENCY_VERSIONS["astro"],
  };
  let devDependencies: Record<string, string> | undefined;
  if (options.auth && options.sampleTool) {
    // The sample tool's `QuartalPluginContext` parameter type comes from the core package.
    dependencies["@quartal/plugin-core"] = DEPENDENCY_VERSIONS["@quartal/plugin-core"];
  }
  if (options.widgets === "vue") {
    dependencies["@astrojs/vue"] = DEPENDENCY_VERSIONS["@astrojs/vue"];
    dependencies["@quartal/plugin-vue"] = DEPENDENCY_VERSIONS["@quartal/plugin-vue"];
    dependencies["vue"] = DEPENDENCY_VERSIONS["vue"];
  }
  if (options.widgets === "react") {
    dependencies["@astrojs/react"] = DEPENDENCY_VERSIONS["@astrojs/react"];
    dependencies["react"] = DEPENDENCY_VERSIONS["react"];
    dependencies["react-dom"] = DEPENDENCY_VERSIONS["react-dom"];
    devDependencies = {
      "@types/react": DEPENDENCY_VERSIONS["@types/react"],
      "@types/react-dom": DEPENDENCY_VERSIONS["@types/react-dom"],
    };
  }
  const pkg = {
    name: options.name,
    type: "module",
    version: "0.1.0",
    description: options.description || "A Quartal Plugin.",
    private: true,
    scripts: { dev: "astro dev", build: "astro build", preview: "astro preview" },
    dependencies: sortKeys(dependencies),
    ...(devDependencies ? { devDependencies: sortKeys(devDependencies) } : {}),
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

/** Renders `qrtl.config.ts` with the chosen auth mode and commented-out optional settings. */
function renderQrtlConfig(options: CreatePluginOptions): string {
  const auth = options.auth ? "quartal-hub" : "anon";
  const authEnvComment = options.auth
    ? `\n  // "quartal-hub" is preconfigured for the Quartal Hub test environment; set OAUTH_ISSUER\n  // to point at another IAM instance. "custom" reads all OAUTH_* env vars instead.`
    : "";
  return `import { defineQrtlConfig } from "@quartal/plugin";

// Plugin metadata and options — see https://plugin.quartal.com for the full reference.
export default defineQrtlConfig({
  title: ${JSON.stringify(titleFromName(options.name))},
  description: ${JSON.stringify(options.description || "A Quartal Plugin.")},
  // Auth mode: "anon" (no authentication), "quartal-hub" (OAuth2 via Quartal Hub), or
  // "custom" (your own OAuth2 / OIDC server).${authEnvComment}
  auth: ${JSON.stringify(auth)},
  // Logo and icons shown by MCP clients and the docs site:
  // style: {
  //   logo: "https://example.com/logo.png",
  //   icons: [{ src: "https://example.com/icon.png", mimeType: "image/png", sizes: ["128x128"] }],
  // },
  // Publishing to Quartal Hub:
  // deploy: { org: "my-org", app: ${JSON.stringify(unscopedName(options.name))} },
});
`;
}

/** Renders `astro.config.mjs` with the integrations the chosen widget framework needs. */
function renderAstroConfig(options: CreatePluginOptions): string {
  const frameworkImport = options.widgets === "vue"
    ? `import vue from "@astrojs/vue";\n`
    : options.widgets === "react"
    ? `import react from "@astrojs/react";\n`
    : "";
  const integrations = options.widgets === "vue"
    ? `[vue(), qrtlPlugin()]`
    : options.widgets === "react"
    ? `[react(), qrtlPlugin()]`
    : `[qrtlPlugin()]`;
  return `import { defineConfig } from "astro/config";
import node from "@astrojs/node";
${frameworkImport}import qrtlPlugin from "@quartal/plugin/astro";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: ${integrations},
});
`;
}

/** Renders the barrel that the codegen analyzes: every export becomes MCP tools + REST actions. */
function renderToolsMod(options: CreatePluginOptions): string {
  if (options.sampleTool) {
    return `// Every class exported here is analyzed by @quartal/plugin: each public method becomes
// an MCP tool and a REST action. Add your own tool files and export them here.
export * from "./HelloWorld.ts";
`;
  }
  return `// Every class exported here is analyzed by @quartal/plugin: each public method becomes
// an MCP tool and a REST action. Add your own tool files and export them here, e.g.:
// export * from "./MyTool.ts";
export {};
`;
}

/** Renders the project README with run instructions and pointers to make it the author's own. */
function renderReadme(options: CreatePluginOptions): string {
  const title = titleFromName(options.name);
  return `# ${title}

${options.description || "A Quartal Plugin."}

> This README was generated by \`@quartal/create-plugin\` — replace it with your own.

## Develop

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

The plugin runs on <http://localhost:4321>:

| URL | What |
|---|---|
| \`/\` | Documentation site for your plugin |
| \`/mcp\` | The MCP server — connect any MCP client here |
| \`/api/<Class>/<method>\` | The generated OpenAPI / REST actions |
| \`/plugin.json\` | The Agent Plugins manifest (\`/plugin.zip\` is the installable package) |
| \`/widgets/<toolId>\` | Widget pages |
| \`/skills/catalog.json\` | The Agent Skills catalog |

## Learn more

- Getting started and reference: <https://plugin.quartal.com>
- Tools live in \`src/tools/\`, widgets in \`src/pages/widgets/\`, skills in \`skills/\`.

## Build and deploy

\`\`\`bash
pnpm build
node ./dist/server/entry.mjs
\`\`\`
`;
}

/**
 * Renders `AGENTS.md`: the project conventions for coding agents (Claude Code, Cursor, Copilot,
 * Codex and others read this file), adjusted to the chosen options.
 */
function renderAgentsMd(options: CreatePluginOptions): string {
  const lines: string[] = [
    `# ${titleFromName(options.name)} — guide for coding agents`,
    "",
    "This is a **Quartal Plugin**: an Astro app where plain TypeScript classes become MCP tools,",
    "REST actions, widgets and Agent Skills. Full documentation: <https://plugin.quartal.com>",
    "(machine-readable index: <https://plugin.quartal.com/llms.txt>).",
    "",
    "## Commands",
    "",
    "- `pnpm install` — install dependencies",
    "- `pnpm dev` — dev server on <http://localhost:4321>",
    "- `pnpm build && node ./dist/server/entry.mjs` — production build and run",
    "",
    "The server serves the plugin's docs site (with tool and widget testers) at `/`, the MCP server",
    "at `/mcp`, REST actions at `/api/<Class>/<method>`, widget pages at `/widgets/<toolId>` and the",
    "Agent Plugins manifest at `/plugin.json`.",
    "",
    "## Conventions",
    "",
    "- **Tools** are classes in `src/tools/`, exported from `src/tools/mod.ts`. Every public method",
    "  of an exported class becomes an MCP tool and a REST action.",
    "- **Schemas are generated** from the TypeScript types and JSDoc — including tags like",
    "  `@format`, `@example` and `@visibility`. Never hand-write JSON Schema and never add a schema",
    "  library (zod etc.); improve the types and JSDoc instead.",
  ];
  if (options.widgets !== "none") {
    lines.push(
      "- **Widgets** are Astro pages in `src/pages/widgets/`; a page's file name must be the id of",
      "  the tool it visualizes (`sayHello.astro` is the UI for the `sayHello` tool).",
    );
  }
  lines.push(
    "- **Skills**: to ship know-how alongside the tools, add folders with a `SKILL.md` under",
    "  `skills/`.",
    "- **Plugin options** (title, description, auth, deploy) live in `qrtl.config.ts`.",
    options.auth
      ? "- **Auth**: this plugin uses Quartal Hub OAuth2 (`auth: \"quartal-hub\"`) — preconfigured\n" +
        "  for the Quartal Hub test environment; set OAUTH_ISSUER to point at another IAM instance."
      : "- **Auth**: this plugin is anonymous (`auth: \"anon\"` in `qrtl.config.ts`).",
  );
  if (options.sampleTool) {
    lines.push(
      "",
      "`src/tools/HelloWorld.ts` is scaffolded sample code — replace it with real tools and update",
      "the export in `src/tools/mod.ts`." +
        (options.widgets !== "none"
          ? " Rename `src/pages/widgets/sayHello.astro` to match the\nreplacement tool's id (or delete it)."
          : ""),
    );
  }
  lines.push(
    "",
    "## Verify changes",
    "",
    "1. `pnpm build` must succeed — the build analyzes the tool types and fails on schema problems.",
    "2. Start `pnpm dev` and check the tools respond over MCP at `http://localhost:4321/mcp`",
    "   (JSON-RPC `tools/list` / `tools/call`), or use the testers on the docs site at `/`.",
    "",
  );
  return lines.join("\n");
}

/** Returns a copy of the record with alphabetically sorted keys (stable `package.json` output). */
function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}
