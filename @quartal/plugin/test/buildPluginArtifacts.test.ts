import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildPluginArtifacts, buildMcpTools, loadCodeFiles, writeJsonToFile } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

describe("writeJsonToFile", () => {
  it("writes pretty JSON with trailing newline", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hub-artifacts-"));
    const path = join(dir, "out.json");
    try {
      await writeJsonToFile(path, { ok: true });
      expect(await readFile(path, "utf-8")).toBe('{\n  "ok": true\n}\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("buildPluginArtifacts", () => {
  it("builds MCP tools with string enum input schemas", () => {
    const files = analyzeSource({
      "/tools/model/ReportInput.ts": `
        /** Report input. */
        export interface ReportInput { /** lang */ lang?: "fi" | "sv"; }
      `,
      "/tools/Report.ts": `
        import type { ReportInput } from "./model/ReportInput.ts";
        /** Report. */
        export class Report {
          /** Get report. @param input the input */
          async getReport(input: ReportInput): Promise<string> { return ""; }
        }
      `,
    });

    const mcpTools = buildMcpTools(loadCodeFiles({ files }));
    const reportTool = mcpTools.find((t) => t.methodName === "getReport");
    expect(reportTool).toBeDefined();
    const lang = (reportTool!.inputSchema.properties as Record<string, { enum?: string[] }>)?.lang;
    expect(lang?.enum).toEqual(["fi", "sv"]);
  });

  it("produces open-api paths for all tool methods", () => {
    const files = analyzeSource({
      "/tools/Hello.ts": `
        /** Hello. */
        export class Hello {
          /** World. @returns a greeting */
          async world(): Promise<string> { return ""; }
        }
      `,
    });

    const artifacts = buildPluginArtifacts(files, {
      name: "@test/pkg",
      title: "Test Pkg",
      description: "test",
      version: "1.0.0",
      style: { logo: "", icons: [{ src: "https://cdn.example/icon.png", sizes: ["128x128"] }] },
      imports: {},
    });

    const paths = artifacts.openApi.paths as Record<string, unknown>;
    expect(paths["/api/Hello/world"]).toBeDefined();
    expect(artifacts.files.some((f) => f.path === "__system__.ts")).toBe(true);

    const tags = artifacts.openApi.tags as { name: string }[];
    expect(tags.some((t) => t.name === "Hello")).toBe(true);
    const op = (paths["/api/Hello/world"] as { post?: { tags?: string[] } })?.post;
    expect(op?.tags).toEqual(["Hello"]);
  });
});
