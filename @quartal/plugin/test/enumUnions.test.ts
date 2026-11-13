import { describe, expect, it } from "vitest";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { buildMcpTools, loadCodeFiles, ZodBuilder } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

const SOURCES = {
  "/vendor/salaxy.ts": `
    /** Calc report type. */
    export type calcReportType = "salarySlip" | "employerReport";
  `,
  "/tools/ReportInput.ts": `
    import type { calcReportType } from "../vendor/salaxy.ts";
    /** Report input. */
    export interface ReportInput {
      /** report type */ reportType?: calcReportType;
      /** lang */ lang?: "fi" | "sv" | "en";
    }
  `,
  "/tools/Report.ts": `
    import type { ReportInput } from "./ReportInput.ts";
    /** Report. */
    export class Report {
      /** Generate. @param input the input */
      async generate(input: ReportInput): Promise<string> { return ""; }
    }
  `,
};

describe("string literal unions", () => {
  it("parses an inline string-literal union on a property as a joined type", () => {
    const files = analyzeSource(SOURCES);
    const lang = files.flatMap((f) => f.types).find((t) => t.name === "ReportInput")
      ?.properties.find((p) => p.name === "lang");
    expect(lang?.type).toBe('"fi" | "sv" | "en"');
  });

  it("parses a string-literal type alias (imported) as enum members", () => {
    const files = analyzeSource(SOURCES);
    const imported = files.find((f) => f.path === "types/imported-types.ts");
    const calcReportType = imported?.types.find((t) => t.name === "calcReportType");
    expect(calcReportType?.enum).toEqual(["salarySlip", "employerReport"]);
  });
});

describe("ZodBuilder string literal unions", () => {
  it("emits OpenAPI enum for lang and reportType", () => {
    const files = analyzeSource(SOURCES);
    const zb = new ZodBuilder(files);
    const fn = zb.getZodsForAllFunctions().find((f) => f.fn.name === "generate");
    expect(fn).toBeDefined();

    const app = new OpenAPIHono();
    app.openapi(
      createRoute({
        method: "post",
        path: "/test",
        request: { body: { content: { "application/json": { schema: fn!.input } } } },
        responses: { 200: { description: "ok", content: { "application/json": { schema: z.string() } } } },
      }),
      (c) => c.json("ok"),
    );

    const doc = app.getOpenAPIDocument({ openapi: "3.0.0", info: { title: "t", version: "1" } });
    const props = (doc.components?.schemas as Record<string, { properties?: Record<string, { enum?: string[] }> }>)
      ?.ReportInput?.properties;
    expect(props?.lang?.enum).toEqual(["fi", "sv", "en"]);
    expect(props?.reportType?.enum).toEqual(["salarySlip", "employerReport"]);
  });
});

// String literal values that are also type keywords, such as "unknown", are values, not types
const KEYWORD_SOURCES = {
  "/tools/model/FooBar.ts": `
    export interface Foo { a: boolean; }
    export interface Bar { b: boolean; }
  `,
  "/tools/FooTools.ts": `
    import type { Foo, Bar } from "./model/FooBar.ts";
    export interface Result {
      keywordUnion: "foobar" | "unknown" | "string";
      nullableKeyword: "unknown" | null;
      namedUnion?: Foo | Bar;
    }
    export class FooTools {
      foo(input: { keywordUnion: "object" | "null" }): Result {
        return { keywordUnion: "unknown", nullableKeyword: null };
      }
    }
  `,
};

describe("string literal values that are also type keywords", () => {
  const codeFiles = () => loadCodeFiles({ files: analyzeSource(KEYWORD_SOURCES) });
  const mcpTool = () => buildMcpTools(codeFiles()).find((t) => t.methodName === "foo")!;
  type Schema = { properties: Record<string, Record<string, unknown>> };

  it("are quoted in the analyzer output, unlike type names", () => {
    const result = codeFiles().flatMap((f) => f.types).find((t) => t.name === "Result");
    expect(result?.properties.find((p) => p.name === "keywordUnion")?.type).toBe('"foobar" | "unknown" | "string"');
    expect(result?.properties.find((p) => p.name === "nullableKeyword")?.type).toBe('"unknown"');
    expect(result?.properties.find((p) => p.name === "namedUnion")?.type).toBe("Foo | Bar");
  });

  it("become an enum in the output schema", () => {
    const props = (mcpTool().outputSchema as Schema).properties;
    expect(props.keywordUnion).toMatchObject({ enum: ["foobar", "unknown", "string", null] });
  });

  it("do not affect a union of named types, which becomes a oneOf of object schemas", () => {
    const namedUnion = (mcpTool().outputSchema as Schema).properties.namedUnion as { oneOf: Record<string, unknown>[] };
    expect(namedUnion.oneOf.slice(0, 2).map((s) => Object.keys((s.properties ?? {}) as object))).toEqual([["a"], ["b"]]);
  });

  it("become an enum in the input schema", () => {
    const props = (mcpTool().inputSchema as Schema).properties;
    expect(props.keywordUnion).toMatchObject({ type: "string", enum: ["object", "null"] });
  });

  it("are validated as values in tool inputs", () => {
    const fn = new ZodBuilder(codeFiles()).getZodsForAllFunctions().find((f) => f.fn.name === "foo")!;
    expect(fn.input.safeParse({ keywordUnion: "null" }).success).toBe(true);
    expect(fn.input.safeParse({ keywordUnion: "object" }).success).toBe(true);
    expect(fn.input.safeParse({ keywordUnion: "string" }).success).toBe(false);
  });
});
