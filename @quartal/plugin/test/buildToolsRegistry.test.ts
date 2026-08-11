import { describe, expect, it } from "vitest";
import { buildToolsRegistrySource } from "../src/index.ts";
import type { CodeFile } from "../src/index.ts";

function toolFile(name: string, className: string, path?: string): CodeFile {
  return {
    name,
    lang: "ts",
    path: path ?? `tools/${name}`,
    content: "",
    classes: [{ name: className, description: "", functions: [], properties: [], implements: [] }],
    types: [],
  };
}

function typeFile(name: string, path: string): CodeFile {
  return { name, lang: "ts", path, content: "", classes: [], types: [{ name: "T", description: "", properties: [], extends: [] }] };
}

describe("buildToolsRegistrySource", () => {
  it("emits a static import map for tool files only", () => {
    const files: CodeFile[] = [
      typeFile("__system__.ts", "__system__.ts"),
      toolFile("Calculator.ts", "Calculator"),
      toolFile("HelloWorld.ts", "HelloWorld"),
      typeFile("imported-types.ts", "types/imported-types.ts"),
    ];
    const src = buildToolsRegistrySource(files);

    // system + imported types excluded
    expect(src).not.toContain("__system__");
    expect(src).not.toContain("imported-types");

    // one import per tool file, sorted, relative to ../tools
    expect(src).toContain('import * as m0 from "../tools/Calculator.ts";');
    expect(src).toContain('import * as m1 from "../tools/HelloWorld.ts";');

    // registry maps fileName -> module
    expect(src).toContain('"Calculator": m0');
    expect(src).toContain('"HelloWorld": m1');
    expect(src).toContain("export const toolModules");
  });

  it("honours a custom import base and dedupes/sorts", () => {
    const files: CodeFile[] = [
      toolFile("Zeta.ts", "Zeta"),
      toolFile("Alpha.ts", "Alpha"),
    ];
    const src = buildToolsRegistrySource(files, { importBase: "../src/tools" });
    const alphaIdx = src.indexOf("Alpha.ts");
    const zetaIdx = src.indexOf("Zeta.ts");
    expect(alphaIdx).toBeGreaterThan(-1);
    expect(alphaIdx).toBeLessThan(zetaIdx); // sorted
    expect(src).toContain('from "../src/tools/Alpha.ts";');
  });
});
