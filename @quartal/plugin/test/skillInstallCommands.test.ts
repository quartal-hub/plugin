import { describe, expect, it } from "vitest";
import { githubTreeUrl, normalizeRepoDirectory, npxSkillsAddCommand, parseGithubRepo } from "@quartal/plugin-core";
import type { PluginManifest, PluginRepository } from "../src/model/index.ts";
import {
  buildNpxSkillsAddCommand,
  buildSkillGithubTreeUrl,
  buildSkillsFolderGithubTreeUrl,
  parseGithubRepository,
} from "../src/hono-app/skillInstallCommands.ts";

// The in-repo path of a plugin comes from npm's `repository.directory`, never from the plugin
// name: `@samples/test1` lives in `samples/test1`.

const REPO_URL = "https://github.com/some-owner/some-repo.git";

function repo(directory?: string): PluginRepository {
  return { type: "git", url: REPO_URL, ...(directory ? { directory } : {}) };
}

function pkg(repository?: PluginRepository): PluginManifest {
  return {
    name: "@samples/test1",
    title: "Test 1",
    description: "d",
    version: "1.0.0",
    style: { logo: "l", icons: [] },
    ...(repository ? { repository } : {}),
  };
}

describe("parseGithubRepo", () => {
  it("parses owner and repo, with or without .git", () => {
    expect(parseGithubRepo(REPO_URL)).toEqual({ owner: "some-owner", repo: "some-repo" });
    expect(parseGithubRepo("https://github.com/some-owner/some-repo")).toEqual({
      owner: "some-owner",
      repo: "some-repo",
    });
  });

  it("rejects non-GitHub hosts, incomplete paths and garbage", () => {
    expect(parseGithubRepo("https://gitlab.com/o/r.git")).toBeNull();
    expect(parseGithubRepo("https://github.com/only-owner")).toBeNull();
    expect(parseGithubRepo("not a url")).toBeNull();
  });

  it("is mirrored by the plugin-side parseGithubRepository (undefined instead of null)", () => {
    expect(parseGithubRepository(REPO_URL)).toEqual({ owner: "some-owner", repo: "some-repo" });
    expect(parseGithubRepository("https://gitlab.com/o/r.git")).toBeUndefined();
  });
});

describe("normalizeRepoDirectory", () => {
  it("strips ./, leading/trailing slashes and normalizes backslashes", () => {
    expect(normalizeRepoDirectory("samples/test1")).toBe("samples/test1");
    expect(normalizeRepoDirectory("./samples/test1")).toBe("samples/test1");
    expect(normalizeRepoDirectory("/samples/test1/")).toBe("samples/test1");
    expect(normalizeRepoDirectory("samples\\test1")).toBe("samples/test1");
  });

  it("returns an empty string for a root plugin", () => {
    expect(normalizeRepoDirectory(undefined)).toBe("");
    expect(normalizeRepoDirectory("")).toBe("");
    expect(normalizeRepoDirectory("./")).toBe("");
  });
});

describe("githubTreeUrl", () => {
  it("joins repository.directory with the sub path", () => {
    expect(githubTreeUrl(repo("samples/test1"), "skills/coin-flipper")).toBe(
      "https://github.com/some-owner/some-repo/tree/main/samples/test1/skills/coin-flipper",
    );
  });

  it("omits the directory segment when the plugin is at the repo root", () => {
    expect(githubTreeUrl(repo(), "skills/coin-flipper")).toBe(
      "https://github.com/some-owner/some-repo/tree/main/skills/coin-flipper",
    );
  });

  it("honours a non-default branch", () => {
    expect(githubTreeUrl(repo("samples/test1"), "skills", "develop")).toBe(
      "https://github.com/some-owner/some-repo/tree/develop/samples/test1/skills",
    );
  });

  it("returns null without a usable repository", () => {
    expect(githubTreeUrl(undefined, "skills")).toBeNull();
    expect(githubTreeUrl({ type: "git", url: "https://gitlab.com/o/r.git" }, "skills")).toBeNull();
  });
});

describe("npxSkillsAddCommand", () => {
  it("uses repository.directory, not the scoped plugin name", () => {
    const cmd = npxSkillsAddCommand(repo("samples/test1"), "coin-flipper");
    expect(cmd).toBe(
      "npx skills add https://github.com/some-owner/some-repo/tree/main/samples/test1/skills/coin-flipper",
    );
    expect(cmd).not.toContain("@samples");
  });

  it("falls back to the repository root when directory is absent", () => {
    expect(npxSkillsAddCommand(repo(), "coin-flipper")).toBe(
      "npx skills add https://github.com/some-owner/some-repo/tree/main/skills/coin-flipper",
    );
  });

  it("returns null when there is no GitHub repository to link to", () => {
    expect(npxSkillsAddCommand(undefined, "coin-flipper")).toBeNull();
    expect(npxSkillsAddCommand({ type: "git", url: "" }, "coin-flipper")).toBeNull();
  });
});

describe("buildSkillGithubTreeUrl / buildSkillsFolderGithubTreeUrl", () => {
  it("builds skill and skills-folder URLs from repository.directory", () => {
    const info = pkg(repo("samples/test1"));
    expect(buildSkillGithubTreeUrl(info, "coin-flipper")).toBe(
      "https://github.com/some-owner/some-repo/tree/main/samples/test1/skills/coin-flipper",
    );
    expect(buildSkillsFolderGithubTreeUrl(info)).toBe(
      "https://github.com/some-owner/some-repo/tree/main/samples/test1/skills",
    );
  });

  it("treats a plugin without directory as living at the repo root", () => {
    const info = pkg(repo());
    expect(buildSkillGithubTreeUrl(info, "coin-flipper")).toBe(
      "https://github.com/some-owner/some-repo/tree/main/skills/coin-flipper",
    );
    expect(buildSkillsFolderGithubTreeUrl(info)).toBe(
      "https://github.com/some-owner/some-repo/tree/main/skills",
    );
  });

  it("returns undefined without a repository", () => {
    expect(buildSkillGithubTreeUrl(pkg(), "coin-flipper")).toBeUndefined();
    expect(buildSkillsFolderGithubTreeUrl(pkg())).toBeUndefined();
  });

  it("wraps a tree URL into the npx command", () => {
    expect(buildNpxSkillsAddCommand("https://example.com/x")).toBe("npx skills add https://example.com/x");
  });
});
