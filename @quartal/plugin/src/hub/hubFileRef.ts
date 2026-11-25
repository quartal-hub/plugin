/**
 * A reference to a file in Quartal Files: `qrtl://<owner>/<drive>/<path>[?version=<id>]`.
 *
 * - `<owner>` is the company's Quartal IAM id, or `~` for "the company the caller's token is for"
 *   (the usual case: a token is issued for one organization, so references need not repeat it).
 * - `?version=<id>` pins an immutable version; references that are stored or passed to another
 *   plugin should be pinned.
 *
 * Use it as the type of a tool input or output property that carries a file: the agent gets the
 * reference from the Quartal Files plugin (upload) and passes it on; the tool reads the bytes with
 * `getExperimentalHubContext(ctx).files.open(ref)`, authorized by the caller's own token.
 */
export type HubFileRef = string;

/** The parts of a {@link HubFileRef}. */
export interface HubFileRefParts {
  /** The company's Quartal IAM id, or `~` for the company the token is for. */
  owner: string;
  /** The file's path including the drive, e.g. `/data/reports/2026.pdf`. */
  path: string;
  /** A pinned version, when the reference has one. */
  version?: string;
}

/** The scheme of Quartal Files references. */
export const HUB_FILE_REF_SCHEME = "qrtl://";
/** The owner placeholder for "the company the caller's token is for". */
export const TOKEN_OWNER = "~";

/**
 * Splits a `qrtl://` reference into owner, path and version.
 * @param ref The reference.
 * @returns The parts.
 * @throws When `ref` is not a `qrtl://<owner>/<drive>/…` reference.
 */
export function parseHubFileRef(ref: HubFileRef): HubFileRefParts {
  if (!ref.startsWith(HUB_FILE_REF_SCHEME)) {
    throw new Error(`Not a Quartal Files reference (qrtl://<owner>/<drive>/<path>): ${ref}`);
  }
  const rest = ref.slice(HUB_FILE_REF_SCHEME.length);
  const query = rest.indexOf("?");
  const location = query === -1 ? rest : rest.slice(0, query);
  const slash = location.indexOf("/");
  if (slash <= 0 || slash === location.length - 1) {
    throw new Error(`A Quartal Files reference needs an owner and a drive: ${ref}`);
  }
  const owner = decodeURIComponent(location.slice(0, slash));
  const path = location.slice(slash).split("/").map((segment) => decodeURIComponent(segment)).join("/");
  const version = query === -1 ? undefined : new URLSearchParams(rest.slice(query + 1)).get("version") ?? undefined;
  return { owner, path, ...(version ? { version } : {}) };
}

/**
 * Builds a `qrtl://` reference.
 * @param parts Owner (an IAM id or `~`), path including the drive, and an optional version.
 * @returns The reference.
 */
export function formatHubFileRef(parts: HubFileRefParts): HubFileRef {
  const owner = parts.owner === TOKEN_OWNER ? TOKEN_OWNER : encodeURIComponent(parts.owner);
  const path = (parts.path.startsWith("/") ? parts.path : `/${parts.path}`)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const version = parts.version ? `?version=${encodeURIComponent(parts.version)}` : "";
  return `${HUB_FILE_REF_SCHEME}${owner}${path}${version}`;
}

/**
 * Whether a string is a `qrtl://` reference.
 * @param value The value to test.
 */
export function isHubFileRef(value: unknown): value is HubFileRef {
  return typeof value === "string" && value.startsWith(HUB_FILE_REF_SCHEME);
}
