import { parseArgs } from "node:util";

import type { WidgetFramework } from "./CreatePluginOptions.ts";

/** Answers given on the command line; `undefined` means the question was not answered there. */
export interface CliArgs {
  name?: string;
  description?: string;
  auth?: boolean;
  sampleTool?: boolean;
  widgets?: WidgetFramework;
  /** Accept the defaults for every question not answered by a flag (non-interactive mode). */
  yes: boolean;
  help: boolean;
}

const WIDGET_FRAMEWORKS: readonly string[] = ["none", "vue", "react", "js"] satisfies WidgetFramework[];

export const USAGE = `Usage: pnpm create @quartal/plugin [name] [options]
       npm create @quartal/plugin -- [name] [options]

Without options the starter kit asks its questions interactively. Each flag answers
one question; --yes accepts the defaults for the rest, so CI and coding agents can
scaffold without a terminal: pnpm create @quartal/plugin my-plugin --yes

Options:
  -d, --description <text>   One-line description (default: "")
      --auth                 Quartal Hub authentication (OAuth2, auth: "quartal-iam")
      --no-auth              Anonymous plugin, auth: "anon" (default)
      --sample-tool          Scaffold the HelloWorld sample tool (default)
      --no-sample-tool       Skip the sample tool
  -w, --widgets <framework>  Widget framework: none | vue (default) | react | js
  -y, --yes                  Accept defaults for all unanswered questions; requires [name]
  -h, --help                 Show this help`;

/**
 * Parses CLI arguments into per-question answers.
 * @param argv Arguments after the bin name.
 * @throws Error with a user-facing message on unknown or conflicting flags and bad values.
 */
export function parseCliArgs(argv: string[]): CliArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      description: { type: "string", short: "d" },
      auth: { type: "boolean" },
      "no-auth": { type: "boolean" },
      "sample-tool": { type: "boolean" },
      "no-sample-tool": { type: "boolean" },
      widgets: { type: "string", short: "w" },
      yes: { type: "boolean", short: "y" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (positionals.length > 1) {
    throw new Error(`Expected at most one positional argument (the plugin name), got: ${positionals.join(", ")}`);
  }
  if (values.auth && values["no-auth"]) throw new Error("--auth and --no-auth are mutually exclusive.");
  if (values["sample-tool"] && values["no-sample-tool"]) {
    throw new Error("--sample-tool and --no-sample-tool are mutually exclusive.");
  }
  if (values.widgets !== undefined && !WIDGET_FRAMEWORKS.includes(values.widgets)) {
    throw new Error(`--widgets must be one of ${WIDGET_FRAMEWORKS.join(", ")}; got "${values.widgets}".`);
  }

  return {
    name: positionals[0],
    description: values.description,
    auth: values.auth ? true : values["no-auth"] ? false : undefined,
    sampleTool: values["sample-tool"] ? true : values["no-sample-tool"] ? false : undefined,
    widgets: values.widgets as WidgetFramework | undefined,
    yes: values.yes ?? false,
    help: values.help ?? false,
  };
}
