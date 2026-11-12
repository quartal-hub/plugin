/**
 * Base URLs of the Quartal Hub services behind {@link ExperimentalHubContext} — the one place they
 * are defined. They point at the Quartal Hub test environment, the same one `auth: "quartal-hub"`
 * signs users in to, so the caller's access token is accepted by every service as it is.
 * @experimental The URLs and their configuration will change.
 */
export const EXPERIMENTAL_HUB_SERVICE_URLS = {
  /** Quartal IAM API: the user's companies, their customers and the user's secrets. */
  iam: "https://iam-api.test.qrtl.com",
  /** Quartal Files: a company's drives, folders and files. */
  files: "https://files-plugin.quartal.site",
} as const;

/** Process-wide switch, kept on `globalThis` so it holds even when the package is loaded twice (dev SSR). */
const STATE_KEY = Symbol.for("@quartal/plugin.experimentalHub");

interface ExperimentalHubState {
  enabled: boolean;
}

function state(): ExperimentalHubState {
  const g = globalThis as { [STATE_KEY]?: ExperimentalHubState };
  return (g[STATE_KEY] ??= { enabled: false });
}

/**
 * Turns the experimental Quartal Hub services on or off for this process. The auth app turns them
 * on when the plugin runs with `auth: "quartal-hub"`; every other mode leaves them off.
 * @param enabled Whether {@link getExperimentalHubContext} may be used.
 */
export function setExperimentalHubEnabled(enabled: boolean): void {
  state().enabled = enabled;
}

/** Whether the experimental Quartal Hub services are on: the plugin runs with `auth: "quartal-hub"`. */
export function isExperimentalHubEnabled(): boolean {
  return state().enabled;
}
