import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { qrtlCodegenPlugin } from "../src/index.ts";
import type { ViteDevServerLike } from "../src/vite/qrtlCodegenPlugin.ts";

const PKG_DIR = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

const exists = async (p: string): Promise<boolean> => access(p).then(() => true).catch(() => false);

describe("qrtlCodegenPlugin", () => {
  it("runs codegen on buildStart", async () => {
    const out = await mkdtemp(join(tmpdir(), "qrtl-plugin-"));
    try {
      const plugin = qrtlCodegenPlugin({ cwd: PKG_DIR, out });
      expect(plugin.name).toBe("qrtl-plugin-codegen");
      await plugin.buildStart?.();
      expect(await exists(join(out, "tools.json"))).toBe(true);
      expect(await exists(join(out, "tools.registry.ts"))).toBe(true);
      expect(await exists(join(out, "contents.json"))).toBe(true);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it("registers tool/skill watchers on configureServer", () => {
    const added: string[] = [];
    const events: string[] = [];
    const server: ViteDevServerLike = {
      watcher: {
        add: (paths) => {
          for (const p of Array.isArray(paths) ? paths : [paths]) added.push(p);
        },
        on: (event) => {
          events.push(event);
        },
      },
    };
    const plugin = qrtlCodegenPlugin({ cwd: PKG_DIR });
    plugin.configureServer?.(server);

    expect(added.some((p) => p.endsWith(join("src", "tools")))).toBe(true);
    expect(added.some((p) => p.endsWith("skills"))).toBe(true);
    expect(events).toContain("change");
  });
});
