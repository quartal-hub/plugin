import { githubTreeUrl, parseGithubRepo } from "@quartal/plugin-core";
import type { PluginManifest } from "../model/index.ts";

const DEFAULT_GITHUB_BRANCH = "main";

/** Parses `https://github.com/owner/repo.git` → `{ owner, repo }`. */
export function parseGithubRepository(repositoryUrl: string): { owner: string; repo: string } | undefined {
  return parseGithubRepo(repositoryUrl) ?? undefined;
}

/**
 * GitHub tree URL for installing one skill via `npx skills add`.
 *
 * The in-repo path is taken from `repository.directory` (npm's standard field), so it works for
 * plugins whose folder name differs from their scoped npm name. Plugins without `directory` are
 * treated as living at the repository root.
 * @param manifest Plugin metadata (uses `repository.url` and `repository.directory`).
 * @param skillName Skill folder name.
 * @param branch Git branch (default `main`).
 */
export function buildSkillGithubTreeUrl(
  manifest: PluginManifest,
  skillName: string,
  branch = DEFAULT_GITHUB_BRANCH,
): string | undefined {
  return githubTreeUrl(manifest.repository, `skills/${skillName}`, branch) ?? undefined;
}

/** GitHub tree URL for the plugin's skills folder.
 * @param manifest Plugin metadata.
 * @param branch Git branch (default `main`).
 */
export function buildSkillsFolderGithubTreeUrl(
  manifest: PluginManifest,
  branch = DEFAULT_GITHUB_BRANCH,
): string | undefined {
  return githubTreeUrl(manifest.repository, "skills", branch) ?? undefined;
}

/** `npx skills add <url>` command string. */
export function buildNpxSkillsAddCommand(githubTreeUrl: string): string {
  return `npx skills add ${githubTreeUrl}`;
}
