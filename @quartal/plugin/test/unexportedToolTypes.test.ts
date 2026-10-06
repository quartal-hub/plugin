import { describe, expect, it } from "vitest";

import { analyzeSource } from "./helpers/analyzeSource.ts";

/** A tool whose result type lives in a file that `mod.ts` does not export. */
const TOOL = `
  import type { ReportView } from "./types/Model.ts";
  /** Reports. */
  export class Reports {
    /** Gets a report. @param input the input */
    getReport(input: { /** Which one. */ type: string }): ReportView { return { rows: [] }; }
  }
`;

const MODEL = `
  /** Row of a report. */
  export interface ReportRow {
    /** Row name. */ name: string;
  }
  /** The report. */
  export interface ReportView {
    /** The rows. */ rows: ReportRow[];
  }
  /** Not referenced by any tool. */
  export interface Unused {
    /** Never reached. */ x: string;
  }
`;

const propertyNames = (types: { name: string; properties: { name: string }[] }[], name: string): string[] | undefined =>
  types.find((t) => t.name === name)?.properties.map((p) => p.name);

describe("types that a tool signature reaches but mod.ts does not export", () => {
  it("are described, with their subtypes, when the model file is under tools/ but not exported", () => {
    const types = analyzeSource({
      "/tools/mod.ts": `export * from "./Reports.ts";`,
      "/tools/Reports.ts": TOOL,
      "/tools/types/Model.ts": MODEL,
    }).flatMap((f) => f.types);
    expect(propertyNames(types, "ReportView")).toEqual(["rows"]);
    expect(propertyNames(types, "ReportRow")).toEqual(["name"]);
    expect(types.find((t) => t.name === "Unused")).toBeUndefined();
  });

  it("are described when only the subtype is missing from the exports", () => {
    const types = analyzeSource({
      "/tools/mod.ts": `export * from "./Reports.ts"; export * from "./types/Model.ts";`,
      "/tools/Reports.ts": TOOL,
      "/tools/types/Model.ts": MODEL.replace("export interface ReportRow", "interface ReportRow"),
    }).flatMap((f) => f.types);
    expect(propertyNames(types, "ReportView")).toEqual(["rows"]);
    expect(propertyNames(types, "ReportRow")).toEqual(["name"]);
  });
});
