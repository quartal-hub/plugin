import { spawnSync } from "node:child_process";

import { fail, info } from "./log.mjs";

/** Renders a command the way it would be typed in a shell (for logs and `--dry-run`).
 * @param command Executable name.
 * @param args Arguments.
 */
export function formatCommand(command, args) {
  const quoted = args.map((a) => (/[\s"'$]/.test(a) ? JSON.stringify(a) : a));
  return [command, ...quoted].join(" ");
}

/**
 * Runs a command, inheriting stdio. Under `dryRun` the command is printed and skipped, which is
 * what makes the whole pipeline inspectable without any platform credentials.
 * @param command Executable name.
 * @param args Arguments.
 * @param options `cwd`, extra `env`, `dryRun`, and `optional` (log instead of throwing on failure).
 */
export function run(command, args, options = {}) {
  const { cwd, env, dryRun = false, optional = false } = options;
  info(`$ ${formatCommand(command, args)}`);
  if (dryRun) return { status: 0, dryRun: true };

  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: env ? { ...process.env, ...env } : process.env,
  });

  if (result.error?.code === "ENOENT") {
    const message = `\`${command}\` was not found on PATH.`;
    if (optional) {
      info(message);
      return { status: 127 };
    }
    fail(message);
  }
  if (result.status !== 0) {
    const message = `\`${formatCommand(command, args)}\` exited with code ${result.status}.`;
    if (optional) {
      info(message);
      return { status: result.status };
    }
    fail(message);
  }
  return { status: 0 };
}

/** True when `command` can be executed (used for actionable "install the CLI first" errors).
 * @param command Executable name.
 * @param versionArgs Arguments that make the CLI print its version.
 */
export function hasCommand(command, versionArgs = ["--version"]) {
  const result = spawnSync(command, versionArgs, { stdio: "ignore" });
  return !result.error && result.status === 0;
}
