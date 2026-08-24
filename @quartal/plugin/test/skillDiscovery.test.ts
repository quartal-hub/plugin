import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { discoverSkills, isValidSkillName, parseSkillFrontmatter } from "../src/index.ts";

// SKILL.md frontmatter goes through the same YAML parser as agent frontmatter, so skills and
// agents read one dialect: nested maps, block scalars and comments all behave as authored.

const PKG_DIR = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

function skillMd(...lines: string[]): string {
  return ["---", ...lines, "---", "", "# Instructions", "", "Do the thing."].join("\n");
}

describe("parseSkillFrontmatter", () => {
  it("reads the required fields", () => {
    expect(parseSkillFrontmatter(skillMd("name: coin-flipper", "description: Flip a coin."))).toEqual({
      name: "coin-flipper",
      description: "Flip a coin.",
    });
  });

  it("reads the optional fields, including the nested metadata map", () => {
    expect(parseSkillFrontmatter(skillMd(
      "name: my-skill",
      "description: Does a thing.",
      "license: MIT",
      "compatibility: node>=20",
      "metadata:",
      "  type: reference",
      "  version: 2",
    ))).toEqual({
      name: "my-skill",
      description: "Does a thing.",
      license: "MIT",
      compatibility: "node>=20",
      metadata: { type: "reference", version: 2 },
    });
  });

  it("reads a folded description and strips trailing comments", () => {
    const parsed = parseSkillFrontmatter(skillMd(
      "name: my-skill # the one",
      "description: >-",
      "  A long description that the author",
      "  wrapped over two lines.",
    ));
    expect(parsed).toEqual({
      name: "my-skill",
      description: "A long description that the author wrapped over two lines.",
    });
  });

  it("returns null without frontmatter or without the required fields", () => {
    expect(parseSkillFrontmatter("# No frontmatter\n")).toBeNull();
    expect(parseSkillFrontmatter(skillMd("name: nameless-only"))).toBeNull();
  });

  it("throws with a position on malformed YAML", () => {
    expect(() => parseSkillFrontmatter(skillMd("name: my-skill", "description Flip a coin.")))
      .toThrow(/line 2, column 1/);
  });
});

describe("isValidSkillName", () => {
  it("accepts lowercase names with single hyphens", () => {
    expect(["a", "coin-flipper", "l33t-translator"].every(isValidSkillName)).toBe(true);
  });

  it("rejects uppercase, edge hyphens and double hyphens", () => {
    expect(["CoinFlipper", "-lead", "trail-", "double--hyphen", ""].some(isValidSkillName)).toBe(false);
  });
});

describe("discoverSkills", () => {
  it("discovers the committed fixture skills", async () => {
    const catalog = await discoverSkills(PKG_DIR, "@samples/test1");
    expect(catalog.plugin).toBe("@samples/test1");
    expect(catalog.skills.map((s) => s.name)).toContain("coin-flipper");
    const multiplier = catalog.skills.find((s) => s.name === "magic-multiplier");
    expect(multiplier?.files.map((f) => f.path).sort()).toEqual(["SKILL.md", "scripts/multiplier.ts"].sort());
  });

  it("returns an empty catalog when the plugin ships no skills", async () => {
    const catalog = await discoverSkills(join(PKG_DIR, "agents"), "@samples/test1");
    expect(catalog).toEqual({ version: "1.0", plugin: "@samples/test1", skills: [] });
  });
});

describe("discoverSkills — metadata reaches the catalog", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "qrtl-skills-"));
    await mkdir(join(dir, "skills", "with-metadata"), { recursive: true });
    await writeFile(
      join(dir, "skills", "with-metadata", "SKILL.md"),
      skillMd("name: with-metadata", "description: Has metadata.", "metadata:", "  audience: developers"),
    );
  });

  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("carries the nested metadata map through to the skill entry", async () => {
    const catalog = await discoverSkills(dir, "@samples/tmp");
    expect(catalog.skills[0].metadata).toEqual({ audience: "developers" });
  });
});
