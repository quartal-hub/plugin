import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { collectPluginFileMap, getAnonApp, isExtensionNamespace, listExtensionDirectories } from "../src/index.ts";

// Extension directories: `<reverse-domain namespace>/` at the plugin root is served at the same
// path, listed in plugin.json `extensions` and packaged into plugin.zip.

const pkgDir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

describe("isExtensionNamespace", () => {
  it("accepts reverse-domain names except the reserved overview namespace", () => {
    expect(isExtensionNamespace("com.quartal.hub")).toBe(true);
    expect(isExtensionNamespace("com.quartal.plugin")).toBe(false);
    expect(isExtensionNamespace("skills")).toBe(false);
    expect(isExtensionNamespace(".claude-plugin")).toBe(false);
    expect(isExtensionNamespace("Com.Example")).toBe(false);
  });
});

describe("listExtensionDirectories", () => {
  it("lists the directories and files from disk and from the file map alike", async () => {
    const fromDisk = await listExtensionDirectories(pkgDir);
    expect(fromDisk).toEqual({ "com.example.hub": ["channel.json", "nested/note.txt"] });
    const fileMap = await collectPluginFileMap(pkgDir);
    expect(await listExtensionDirectories("/nowhere", fileMap)).toEqual(fromDisk);
  });
});

describe("served extension directories", () => {
  let app: Hono;
  beforeAll(async () => {
    app = await getAnonApp({ pluginRootFolder: pkgDir, toolModules: {} });
  });

  it("lists the directory in plugin.json", async () => {
    const manifest = await (await app.fetch(new Request("http://x/plugin.json"))).json() as { extensions: Record<string, unknown> };
    expect(manifest.extensions["com.example.hub"]).toEqual({ path: "/com.example.hub/", files: ["channel.json", "nested/note.txt"] });
    expect(manifest.extensions["com.quartal.plugin"]).toBeDefined();
  });

  it("serves the files at the same path and refuses escapes", async () => {
    const res = await app.fetch(new Request("http://x/com.example.hub/channel.json"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: "Example" });
    expect((await app.fetch(new Request("http://x/com.example.hub/nested/note.txt"))).status).toBe(200);
    expect((await app.fetch(new Request("http://x/com.example.hub/missing.json"))).status).toBe(404);
    expect((await app.fetch(new Request("http://x/com.example.hub/..%2Fpackage.json"))).status).toBe(404);
  });
});
