import { describe, expect, it } from "vitest";

import { baseMcpToolName, buildMcpTools, prepareCodeFilesForPlugin, resolveToolAnnotations } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

const tools = (files: Record<string, string>) =>
  buildMcpTools(prepareCodeFilesForPlugin(analyzeSource(files)));

describe("MCP tool names from the CRUD verbs", () => {
  it("completes a bare verb with the class noun, singular for one item and as written for a collection", () => {
    expect(baseMcpToolName("Invoices", "get")).toBe("getInvoice");
    expect(baseMcpToolName("Invoices", "list")).toBe("listInvoices");
    expect(baseMcpToolName("Invoices", "find")).toBe("findInvoices");
    expect(baseMcpToolName("Invoices", "create")).toBe("createInvoice");
    expect(baseMcpToolName("Invoices", "update")).toBe("updateInvoice");
    expect(baseMcpToolName("Invoices", "delete")).toBe("deleteInvoice");
    expect(baseMcpToolName("Invoice", "get")).toBe("getInvoice");
    expect(baseMcpToolName("Invoice", "list")).toBe("listInvoice");
  });

  it("leaves names that carry a noun, and non-CRUD verbs, unchanged", () => {
    expect(baseMcpToolName("Invoices", "getInvoice")).toBe("getInvoice");
    expect(baseMcpToolName("Invoices", "listArchive")).toBe("listArchive");
    expect(baseMcpToolName("Invoices", "approve")).toBe("approve");
    expect(baseMcpToolName("Calculator", "add")).toBe("add");
    expect(baseMcpToolName("Invoices", "sayHello")).toBe("sayHello");
  });

  it("gives both sides of a clash the class prefix", () => {
    const ids = tools({
      "/tools/Invoices.ts": `export class Invoices { get(input: { id: string }): string { return ""; } list(): string[] { return []; } }`,
      "/tools/Customers.ts": `export class Customers { get(input: { id: string }): string { return ""; } }`,
      "/tools/Drafts.ts": `export class Drafts { getInvoice(input: { id: string }): string { return ""; } }`,
    }).map((t) => t.id);
    expect(ids.sort()).toEqual(["Drafts_getInvoice", "Invoices_getInvoice", "getCustomer", "listInvoices"]);
  });
});

describe("MCP annotations from the CRUD verbs", () => {
  it("implies hints per verb and lets explicit tags win", () => {
    expect(resolveToolAnnotations("getInvoice", undefined)).toEqual({ readOnlyHint: true });
    expect(resolveToolAnnotations("listInvoices", undefined)).toEqual({ readOnlyHint: true });
    expect(resolveToolAnnotations("findOverdue", undefined)).toEqual({ readOnlyHint: true });
    expect(resolveToolAnnotations("createInvoice", undefined)).toEqual({ destructiveHint: false });
    expect(resolveToolAnnotations("updateInvoice", undefined)).toEqual({ idempotentHint: true });
    expect(resolveToolAnnotations("deleteInvoice", undefined)).toEqual({ destructiveHint: true, idempotentHint: true });
    expect(resolveToolAnnotations("approve", undefined)).toBeUndefined();
    expect(resolveToolAnnotations("getOrCreateSession", { readOnlyHint: false })).toEqual({ readOnlyHint: false });
    expect(resolveToolAnnotations("deleteDraft", { destructiveHint: false })).toEqual({ destructiveHint: false, idempotentHint: true });
    expect(resolveToolAnnotations("approve", { openWorldHint: false })).toEqual({ openWorldHint: false });
  });

  it("reach the tool descriptors", () => {
    const byName = Object.fromEntries(tools({
      "/tools/Invoices.ts": `
        export class Invoices {
          list(): string[] { return []; }
          /** @readOnly false */
          getOrCreate(input: { id: string }): string { return ""; }
          approve(input: { id: string }): string { return ""; }
        }
      `,
    }).map((t) => [t.methodName, t.annotations]));
    expect(byName.list).toEqual({ readOnlyHint: true });
    expect(byName.getOrCreate).toEqual({ readOnlyHint: false });
    expect(byName.approve).toBeUndefined();
  });
});
