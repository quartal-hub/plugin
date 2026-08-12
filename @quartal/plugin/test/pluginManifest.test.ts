import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Helpers } from "../src/index.ts";

// The manifest reader: package.json identity overlaid with qrtl.config metadata.

const dirs: string[] = [];
async function tempPkg(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "qrtl-manifest-"));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe("Helpers.getPluginManifest", () => {
  it("merges package.json identity with qrtl.config metadata (json)", async () => {
    const dir = await tempPkg({
      "package.json": JSON.stringify({
        name: "@samples/demo",
        version: "2.3.4",
        description: "npm description",
        license: "MIT",
        repository: "https://github.com/quartal-hub/plugin.git",
      }),
      "qrtl.config.json": JSON.stringify({
        title: "Demo Plugin",
        style: { logo: "https://cdn.example.com/logo.png", skin: "https://cdn.example.com/skin.css", icons: [{ src: "https://cdn.example.com/i.png", sizes: ["64x64"] }] },
      }),
    });
    const m = await Helpers.getPluginManifest(dir);
    expect(m.name).toBe("@samples/demo");
    expect(m.version).toBe("2.3.4");
    expect(m.title).toBe("Demo Plugin");
    expect(m.description).toBe("npm description");
    expect(m.license).toBe("MIT");
    expect(m.repository).toEqual({ type: "git", url: "https://github.com/quartal-hub/plugin.git" });
    expect(m.style.logo).toBe("https://cdn.example.com/logo.png");
    expect(m.style.skin).toBe("https://cdn.example.com/skin.css");
    expect(m.style.icons[0]).toMatchObject({ src: "https://cdn.example.com/i.png", sizes: ["64x64"] });
  });

  it("keeps repository.directory from the object form (the plugin folder, not its name)", async () => {
    const dir = await tempPkg({
      "package.json": JSON.stringify({
        name: "@samples/test1",
        version: "1.0.0",
        repository: {
          type: "git",
          url: "https://github.com/quartal-hub/plugin.git",
          directory: "samples/test1",
        },
      }),
    });
    const m = await Helpers.getPluginManifest(dir);
    expect(m.repository).toEqual({
      type: "git",
      url: "https://github.com/quartal-hub/plugin.git",
      directory: "samples/test1",
    });
  });

  it("leaves directory unset for the string shorthand and for objects without it", async () => {
    const shorthand = await tempPkg({
      "package.json": JSON.stringify({
        name: "@samples/a",
        version: "1.0.0",
        repository: "https://github.com/o/r.git",
      }),
    });
    expect((await Helpers.getPluginManifest(shorthand)).repository).toEqual({
      type: "git",
      url: "https://github.com/o/r.git",
    });

    const noDir = await tempPkg({
      "package.json": JSON.stringify({
        name: "@samples/b",
        version: "1.0.0",
        repository: { type: "git", url: "https://github.com/o/r.git" },
      }),
    });
    const m = await Helpers.getPluginManifest(noDir);
    expect(m.repository).toEqual({ type: "git", url: "https://github.com/o/r.git" });
    expect(m.repository).not.toHaveProperty("directory");
  });

  it("works from package.json alone (derives title, default logo/icon)", async () => {
    const dir = await tempPkg({
      "package.json": JSON.stringify({ name: "@samples/solo", version: "1.0.0", description: "Solo package" }),
    });
    const m = await Helpers.getPluginManifest(dir);
    expect(m.name).toBe("@samples/solo");
    expect(m.title.length).toBeGreaterThan(0);
    expect(m.style.logo).toContain("quartal");
    expect(m.style.icons.length).toBeGreaterThan(0);
  });

  it("loads qrtl.config.mjs (default export)", async () => {
    const dir = await tempPkg({
      "package.json": JSON.stringify({ name: "@samples/esm", version: "0.1.0" }),
      "qrtl.config.mjs": "export default { title: 'ESM Configured', auth: 'quartal-iam' };",
    });
    const m = await Helpers.getPluginManifest(dir);
    expect(m.title).toBe("ESM Configured");
    const cfg = await Helpers.loadQrtlConfig(dir);
    expect(cfg?.auth).toBe("quartal-iam");
  });

});
