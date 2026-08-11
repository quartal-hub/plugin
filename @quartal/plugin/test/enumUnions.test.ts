import { describe, expect, it } from "vitest";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { ZodBuilder } from "../src/index.ts";
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
    expect(lang?.type).toBe("fi | sv | en");
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
