import type { PluginRepository } from "../model/index.ts";

/** Parses a GitHub repository URL into owner and repo name.
 * @param url GitHub repository URL (with or without `.git` suffix).
 */
export function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url.replace(/\.git$/, ""));
    if (u.hostname !== "github.com") return null;
    const [owner, repo] = u.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

/** Normalizes a `repository.directory` value into a `/`-separated path segment, or `""` when the
 * plugin sits at the repository root. Leading/trailing slashes and `./` prefixes are stripped so
 * the value can be concatenated into a URL.
 * @param directory Raw `repository.directory` value from package.json (may be undefined).
 */
export function normalizeRepoDirectory(directory?: string): string {
  return (directory ?? "")
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "");
}

/** Builds the GitHub `tree` URL of a path inside a repository.
 * @param repository Repository metadata (`url` and optional `directory`).
 * @param subPath Path relative to the plugin folder (e.g. `skills/my-skill`).
 * @param branch Git branch (default `main`).
 */
export function githubTreeUrl(
  repository: PluginRepository | undefined,
  subPath: string,
  branch = "main",
): string | null {
  if (!repository?.url) return null;
  const gh = parseGithubRepo(repository.url);
  if (!gh) return null;
  const dir = normalizeRepoDirectory(repository.directory);
  const path = [dir, subPath].filter(Boolean).join("/");
  return `https://github.com/${gh.owner}/${gh.repo}/tree/${branch}/${path}`;
}

/** Builds an `npx skills add` command for importing a skill from GitHub.
 *
 * The path inside the repository comes from npm's `repository.directory`, not from the plugin
 * name: a plugin named `@samples/test1` may well live in `samples/test1`. When `directory` is
 * absent the plugin is assumed to be at the repository root.
 * @param repository Repository metadata of the plugin (`url` and optional `directory`).
 * @param skillName Skill directory name under `skills/`.
 * @param branch Git branch (default `main`).
 */
export function npxSkillsAddCommand(
  repository: PluginRepository | undefined,
  skillName: string,
  branch = "main",
): string | null {
  const url = githubTreeUrl(repository, `skills/${skillName}`, branch);
  return url ? `npx skills add ${url}` : null;
}
