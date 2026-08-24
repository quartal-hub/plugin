/**
 * Console helpers shared by the deployment scripts. Deliberately plain text: these scripts run
 * as often in CI logs as in a terminal.
 */

/** Error type for expected failures — `deploy.mjs` prints these without a stack trace. */
export class DeployError extends Error {
  constructor(message) {
    super(message);
    this.name = "DeployError";
  }
}

/** Prints a top-level step heading.
 * @param message Heading text.
 */
export function step(message) {
  console.log(`\n==> ${message}`);
}

/** Prints an indented detail line.
 * @param message Detail text.
 */
export function info(message) {
  console.log(`    ${message}`);
}

/** Prints a warning.
 * @param message Warning text.
 */
export function warn(message) {
  console.warn(`[warn] ${message}`);
}

/** Prints a closing success line.
 * @param message Success text.
 */
export function done(message) {
  console.log(`\n[ok] ${message}`);
}

/** Throws a {@link DeployError} with `message`.
 * @param message Failure reason shown to the user.
 */
export function fail(message) {
  throw new DeployError(message);
}
