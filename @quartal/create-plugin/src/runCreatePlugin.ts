import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import { cancel, confirm, intro, isCancel, note, outro, select, text } from "@clack/prompts";

import type { CliArgs } from "./cliArgs.ts";
import { parseCliArgs, USAGE } from "./cliArgs.ts";
import type { CreatePluginOptions, WidgetFramework } from "./CreatePluginOptions.ts";
import { scaffoldProject, unscopedName } from "./scaffoldProject.ts";

/** npm package-name shape (optionally scoped), which is also a safe directory name. */
const NAME_PATTERN = /^(@[a-z0-9][a-z0-9-_.]*\/)?[a-z0-9][a-z0-9-_.]*$/;

/** Validates a plugin name; returns an error message or undefined when valid. */
export function validatePluginName(name: string, cwd: string): string | undefined {
  if (!name) return "Name is required.";
  if (name.length > 214) return "Name must be at most 214 characters.";
  if (!NAME_PATTERN.test(name)) {
    return "Use a valid npm package name: lowercase letters, digits, `-`, `_` and `.` (optionally @scoped/).";
  }
  if (existsSync(join(cwd, unscopedName(name)))) return `Directory ./${unscopedName(name)} already exists.`;
  return undefined;
}

/** Exits the process when the prompt was cancelled (Ctrl+C / Esc); otherwise returns the value. */
function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled — nothing was created.");
    process.exit(1);
  }
  return value as T;
}

/**
 * Resolves the starter-kit options: answers given as CLI flags are used as-is, `--yes` fills the
 * rest with the defaults, and anything still unanswered is asked interactively.
 */
async function resolveOptions(args: CliArgs, cwd: string): Promise<CreatePluginOptions> {
  let name = args.name ?? "";
  if (name) {
    const problem = validatePluginName(name, cwd);
    if (problem) {
      cancel(problem);
      process.exit(1);
    }
  } else if (args.yes) {
    cancel("--yes needs the plugin name as an argument: pnpm create @quartal/plugin my-plugin --yes");
    process.exit(1);
  } else {
    name = unwrap(
      await text({
        message: "Plugin name (npm package / directory name)",
        placeholder: "my-plugin",
        validate: (value) => validatePluginName(value ?? "", cwd),
      }),
    );
  }

  const description = args.description ?? (args.yes
    ? ""
    : unwrap(
      await text({ message: "Description (optional)", placeholder: "What does your plugin do?", defaultValue: "" }),
    ));

  const auth = args.auth ?? (args.yes ? false : unwrap(
    await confirm({
      message: "Add Quartal Hub authentication? (OAuth2 with the default Quartal auth)",
      initialValue: false,
    }),
  ));

  const sampleTool = args.sampleTool ??
    (args.yes ? true : unwrap(await confirm({ message: "Create a sample tool?", initialValue: true })));

  const widgets = args.widgets ?? (args.yes ? "vue" : unwrap(
    await select<WidgetFramework>({
      message: "Add widgets?",
      initialValue: "vue",
      options: [
        { value: "none", label: "None" },
        { value: "vue", label: "Vue", hint: "default" },
        { value: "react", label: "React" },
        { value: "js", label: "Plain JavaScript" },
      ],
    }),
  ));

  return { name, description, auth, sampleTool, widgets };
}

/**
 * The `create-plugin` CLI: resolves the starter-kit options (flags, `--yes` defaults, interactive
 * prompts), scaffolds the project and prints the next steps.
 * @param argv Arguments after the bin name — see {@link USAGE}.
 */
export async function runCreatePlugin(argv: string[]): Promise<void> {
  const cwd = process.cwd();

  let args: CliArgs;
  try {
    args = parseCliArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`\n${USAGE}`);
    process.exit(1);
  }
  if (args.help) {
    console.log(USAGE);
    return;
  }

  intro("Create a Quartal Plugin");

  const options = await resolveOptions(args, cwd);
  const dir = await scaffoldProject(options, cwd);

  const steps = [
    `cd ${relative(cwd, dir)}`,
    "pnpm install",
    "pnpm dev",
    "",
    options.sampleTool
      ? "1. Check the sample tool: src/tools/HelloWorld.ts"
      : "1. Create your first tool in src/tools/ and export it from src/tools/mod.ts",
    "2. Look at the options in package.json and qrtl.config.ts",
    "3. Replace README.md with your own (AGENTS.md briefs coding agents on the conventions)",
  ];
  if (options.widgets !== "none" && !options.sampleTool) {
    steps.push("4. Rename src/pages/widgets/sayHello.astro to the id of the tool it visualizes");
  }
  note(steps.join("\n"), "Next steps");
  outro("Getting started: https://plugin.quartal.com");
}
