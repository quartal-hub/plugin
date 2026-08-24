#!/usr/bin/env node
/**
 * Deploys a sample plugin from `samples/` to Deno Deploy, Cloudflare Workers or Railway.
 *
 *   node deployment/deploy.mjs <target> <project> [options]
 *
 * The samples are pnpm-workspace members that resolve `@quartal/*` through `workspace:*` and share
 * the repo's `node_modules`, so none of them can be handed to a hosting platform as-is. Every
 * target therefore goes through the same two phases: stage the plugin into a standalone npm package
 * under `.deploy/<target>/<project>/`, then hand that directory to the platform's own CLI.
 *
 * Run `node deployment/deploy.mjs --help` for the full option list.
 */

import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

import { DeployError, done, fail, info, step } from "./lib/log.mjs";
import { listProjects, loadProject } from "./lib/project.mjs";
import { buildStage, createStage } from "./lib/stage.mjs";
import cloudflare from "./targets/cloudflare.mjs";
import deno from "./targets/deno.mjs";
import railway from "./targets/railway.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = new Map([deno, cloudflare, railway].map((t) => [t.id, t]));
const LINK_MODES = new Set(["registry", "local"]);

const HELP = `
Deploy a Quartal sample plugin.

Usage
  node deployment/deploy.mjs <target> <project> [options]
  node deployment/deploy.mjs list

Targets
${[...TARGETS.values()].map((t) => `  ${t.id.padEnd(11)}${t.title} (${t.adapterName})`).join("\n")}

Options
  --org <name>       Platform org/owner. Default: qrtl.config.ts deploy.org
  --app <name>       Remote app/service name. Default: qrtl.config.ts deploy.app
  --link <mode>      How workspace deps are resolved: registry (default) | local
                     registry -> published @quartal/* from npm
                     local    -> copy the built workspace packages into the stage
  --region <region>  Deno Deploy region: us | eu | global (default us)
  --create           First deploy: create the remote app before deploying (Deno Deploy)
  --build            Build inside the stage even when the platform builds remotely
  --no-build         Skip the local build (Cloudflare builds locally by default)
  --stage-only       Stage (and build, if applicable) but do not deploy
  --force            Deploy even when the target reports a known blocker
  --dry-run          Print every command instead of running it
  -h, --help         Show this help

Anything after a bare -- is passed straight through to the platform CLI.

Examples
  node deployment/deploy.mjs railway test1
  node deployment/deploy.mjs deno test1 --create --region eu
  node deployment/deploy.mjs cloudflare test1 --stage-only
  node deployment/deploy.mjs railway test1 --link local --dry-run
`.trimStart();

/** Parses argv into a plain options object.
 * @param argv Arguments after the script name.
 */
function parseArgs(argv) {
  const options = {
    linkMode: "registry",
    region: "us",
    create: false,
    build: undefined,
    stageOnly: false,
    force: false,
    dryRun: false,
    extraArgs: [],
  };
  const positional = [];

  const passthroughAt = argv.indexOf("--");
  if (passthroughAt !== -1) {
    options.extraArgs = argv.slice(passthroughAt + 1);
    argv = argv.slice(0, passthroughAt);
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => argv[++i] ?? fail(`${arg} needs a value.`);
    switch (arg) {
      case "-h": case "--help": options.help = true; break;
      case "--org": options.org = value(); break;
      case "--app": options.app = value(); break;
      case "--link": options.linkMode = value(); break;
      case "--region": options.region = value(); break;
      case "--create": options.create = true; break;
      case "--build": options.build = true; break;
      case "--no-build": options.build = false; break;
      case "--stage-only": options.stageOnly = true; break;
      case "--force": options.force = true; break;
      case "--dry-run": options.dryRun = true; break;
      default:
        if (arg.startsWith("-")) fail(`Unknown option "${arg}". Try --help.`);
        positional.push(arg);
    }
  }

  [options.target, options.project] = positional;
  if (positional.length > 2) fail(`Unexpected argument "${positional[2]}". Try --help.`);
  return options;
}

function printList() {
  console.log("Targets:");
  for (const target of TARGETS.values()) console.log(`  ${target.id.padEnd(11)}${target.title}`);
  console.log("\nProjects (samples/):");
  for (const name of listProjects(REPO_ROOT)) console.log(`  ${name}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || (!options.target && !options.project)) {
    console.log(HELP);
    return;
  }
  if (options.target === "list") {
    printList();
    return;
  }

  const target = TARGETS.get(options.target);
  if (!target) fail(`Unknown target "${options.target}". Expected one of: ${[...TARGETS.keys()].join(", ")}.`);
  if (!options.project) fail(`Missing project name. Available: ${listProjects(REPO_ROOT).join(", ")}.`);
  if (!LINK_MODES.has(options.linkMode)) {
    fail(`Unknown --link mode "${options.linkMode}". Expected registry or local.`);
  }

  const project = await loadProject(REPO_ROOT, options.project);
  const app = options.app ?? project.app;
  const org = options.org ?? project.org;

  step(`${project.pkg.name} -> ${target.title}`);
  info(`source     ${relative(REPO_ROOT, project.dir)}/`);
  info(`app        ${app}${org ? ` (org: ${org})` : ""}`);
  info(`link mode  ${options.linkMode}`);
  if (options.dryRun) info("dry run    no command will actually be executed");

  const stage = createStage({
    project,
    target,
    repoRoot: REPO_ROOT,
    linkMode: options.linkMode,
    dryRun: options.dryRun,
  });

  if (options.build ?? target.buildsLocally) {
    buildStage({ stageDir: stage.dir, dryRun: options.dryRun });
  }

  if (options.stageOnly) {
    done(`Stage ready at ${relative(REPO_ROOT, stage.dir)}/ (not deployed).`);
    printNotes(target);
    return;
  }

  await target.deploy({
    stageDir: stage.dir,
    project,
    app,
    org,
    region: options.region,
    create: options.create,
    dryRun: options.dryRun,
    force: options.force,
    extraArgs: options.extraArgs,
  });

  done(options.dryRun ? "Dry run complete." : `${project.pkg.name} deployed to ${target.title}.`);
  printNotes(target);
}

function printNotes(target) {
  if (!target.notes?.length) return;
  console.log(`\n${target.title} notes:`);
  for (const note of target.notes) console.log(`  - ${note}`);
}

main().catch((error) => {
  if (error instanceof DeployError) {
    console.error(`\nError: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  throw error;
});
