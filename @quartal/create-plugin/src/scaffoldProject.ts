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
 * `qrtl.config.ts`, `astro.config.mjs`, `README.md`, `src/tools/mod.ts`).
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
  const auth = options.auth ? "quartal-iam" : "anon";
  return `import { defineQrtlConfig } from "@quartal/plugin";

// Plugin metadata and options — see https://plugin.quartal.com for the full reference.
export default defineQrtlConfig({
  title: ${JSON.stringify(titleFromName(options.name))},
  description: ${JSON.stringify(options.description || "A Quartal Plugin.")},
  // Auth mode: "anon" (no authentication) or "quartal-iam" (OAuth2 via Quartal Hub).
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
  const auth = options.auth ? "quartal-iam" : "anon";
  const frameworkImport = options.widgets === "vue"
    ? `import vue from "@astrojs/vue";\n`
    : options.widgets === "react"
    ? `import react from "@astrojs/react";\n`
    : "";
  const integrations = options.widgets === "vue"
    ? `[vue(), qrtlPlugin({ auth: "${auth}" })]`
    : options.widgets === "react"
    ? `[react(), qrtlPlugin({ auth: "${auth}" })]`
    : `[qrtlPlugin({ auth: "${auth}" })]`;
  const authComment = options.auth
    ? `  // Quartal auth (OAuth2/OIDC JWT bearer). Defaults derive from the plugin name;\n  // override with OAUTH_ISSUER / OAUTH_AUDIENCE / OAUTH_RESOURCE env vars when needed.\n`
    : "";
  return `import { defineConfig } from "astro/config";
import node from "@astrojs/node";
${frameworkImport}import qrtlPlugin from "@quartal/plugin/astro";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
${authComment}  integrations: ${integrations},
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
| \`/plugin.json\` | The plugin manifest |
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

/** Returns a copy of the record with alphabetically sorted keys (stable `package.json` output). */
function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}
