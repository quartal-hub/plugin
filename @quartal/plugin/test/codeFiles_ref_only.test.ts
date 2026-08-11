import { describe, expect, it } from "vitest";
import { getFunctionsWithResolvedTypes, getSystemCodeFile, ZodBuilder } from "../src/index.ts";
import type { CodeFile } from "../src/index.ts";

/**
 * Build a minimal CodeFile with a recursive Tree type (refs only, no inline type objects).
 * This is the structure TsMorphAnalyzer produces so that JSON serialization never hits cycles.
 */
function buildCodeFileWithRecursiveTree(): CodeFile {
  return {
    name: "TypesTester.ts",
    lang: "ts",
    path: "tools/TypesTester.ts",
    content: "",
    classes: [
      {
        name: "TypesTester",
        description: "",
        functions: [
          {
            name: "treeSum",
            description: "Recursive tree type.",
            parameters: [
              {
                name: "input",
                type: "Tree",
                description: "Root tree node.",
                optional: false,
              },
            ],
            returns: {
              name: "",
              type: "NumberValue",
              description: "",
            },
            isAsync: false,
            isStatic: true,
          },
        ],
        properties: [],
        implements: [],
      },
    ],
    types: [
      {
        name: "Tree",
        description: "Recursive tree node.",
        properties: [
          { name: "value", type: "number", description: "Node value.", optional: false },
          { name: "children", type: { items: "Tree" }, description: "Child nodes.", optional: false },
        ],
        extends: [],
      },
    ],
  };
}

describe("codeFiles ref-only (recursive types)", () => {
  it("codeFiles with recursive Tree type: JSON serialization does not throw", () => {
    const codeFiles: CodeFile[] = [getSystemCodeFile(), buildCodeFileWithRecursiveTree()];
    let json: string;
    try {
      json = JSON.stringify(codeFiles);
    } catch (e) {
      throw new Error(`JSON.stringify(codeFiles) must not throw (ref-only avoids cycles). ${e}`);
    }
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json) as CodeFile[];
    expect(parsed.length).toBe(2);
    const treeFile = parsed.find((f) => f.name === "TypesTester.ts");
    expect(treeFile?.types?.[0]?.name).toBe("Tree");
    expect((treeFile?.types?.[0] as { properties: { type: unknown }[] }).properties[1].type).toEqual({ items: "Tree" });
  });

  it("getFunctionsWithResolvedTypes resolves top-level type refs", () => {
    const codeFiles: CodeFile[] = [getSystemCodeFile(), buildCodeFileWithRecursiveTree()];
    const resolved = getFunctionsWithResolvedTypes(codeFiles);
    const treeSumFn = resolved.find((r) => r.fn.name === "treeSum");
    expect(treeSumFn?.className).toBe("TypesTester");
    expect(treeSumFn?.parameters.length).toBe(1);
    expect(treeSumFn?.parameters[0].name).toBe("input");
    const inputType = treeSumFn?.parameters[0].type;
    expect(typeof inputType).toBe("object");
    expect(inputType !== null && typeof inputType === "object" && "name" in inputType).toBe(true);
    const asCodeType = inputType as { name: string; properties: { name: string }[] };
    expect(asCodeType.name).toBe("Tree");
    expect(asCodeType.properties?.map((p) => p.name)).toEqual(["value", "children"]);
  });

  it("ZodBuilder builds schemas for treeSum and validates Tree-shaped payload", () => {
    const codeFiles: CodeFile[] = [getSystemCodeFile(), buildCodeFileWithRecursiveTree()];
    const creator = new ZodBuilder(codeFiles);
    const defs = creator.getZodsForAllFunctions();
    const treeSumDef = defs.find((d) => d.fn.name === "treeSum");
    expect(treeSumDef != null).toBe(true);
    const treePayload = { value: 1, children: [{ value: 2, children: [] }] };
    const parsed = treeSumDef!.input.safeParse(treePayload);
    if (!parsed.success) {
      throw new Error(`Expected Tree body to validate. Issues: ${JSON.stringify(parsed.error.issues)}`);
    }
    expect(parsed.success).toBe(true);
  });
});
