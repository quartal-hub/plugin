import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateTools } from "../src/index.ts";

// Byte-exact golden check: run the FULL pipeline (TsMorphAnalyzer → buildPluginArtifacts → writers)
// against the committed `test1` fixture plugin and assert the generated artifacts match the committed
// `qrtl-plugin/*.json`. This is the correctness gate that the ts-morph analyzer reproduces the exact
// CodeFile[] contract (and every derived artifact). Comparison is key-order/format independent so
// formatting changes in the writers don't make it brittle.

const PKG_DIR = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));
const GOLDEN_FILES = ["tools.json", "types.json", "mcp-tools.json", "open-api.json", "contents.json"];

/** Deep key-sort so the comparison ignores object key order (and pure formatting), catching only real diffs. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>).sort();
    return Object.fromEntries(entries.map((k) => [k, sortDeep((value as Record<string, unknown>)[k])]));
  }
  return value;
}

describe("golden: TsMorphAnalyzer reproduces the committed test1 artifacts", () => {
  let out: string;

  beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), "qrtl-golden-"));
    await generateTools({ cwd: PKG_DIR, out });
  });

  afterAll(async () => {
    if (out) await rm(out, { recursive: true, force: true });
  });

  for (const file of GOLDEN_FILES) {
    it(`${file} matches the committed artifact`, async () => {
      const generated = JSON.parse(await readFile(join(out, file), "utf-8"));
      const committed = JSON.parse(await readFile(join(PKG_DIR, "qrtl-plugin", file), "utf-8"));
      expect(sortDeep(generated)).toEqual(sortDeep(committed));
    });
  }
});
