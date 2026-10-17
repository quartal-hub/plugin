import { describe, expect, it } from "vitest";

import { parseRestClassTag, parseRestTag } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

describe("parseRestTag (method)", () => {
  it("reads a method, a path, or both, separated by whitespace", () => {
    expect(parseRestTag("DELETE", "X.a")).toEqual({ method: "DELETE" });
    expect(parseRestTag("delete", "X.a")).toEqual({ method: "DELETE" });
    expect(parseRestTag("GET /invoices/{id}", "X.a")).toEqual({ method: "GET", path: "/invoices/{id}" });
    expect(parseRestTag("  put   archive/{year}  ", "X.a")).toEqual({ method: "PUT", path: "archive/{year}" });
    expect(parseRestTag("/invoices", "X.a")).toEqual({ path: "/invoices" });
    expect(parseRestTag("old", "X.a")).toEqual({ path: "old" });
    expect(parseRestTag("/invoices/", "X.a")).toEqual({ path: "/invoices" });
  });

  it("rejects unsupported methods, extra tokens and malformed paths with the method's name", () => {
    expect(() => parseRestTag("PATCH", "Notes.patch")).toThrow(/Notes\.patch: @rest method "PATCH" is not supported; use one of GET, POST, PUT, DELETE/);
    expect(() => parseRestTag("FETCH /x", "Notes.a")).toThrow(/method "FETCH" is not supported/);
    expect(() => parseRestTag("", "Notes.a")).toThrow(/needs a method/);
    expect(() => parseRestTag("GET /a b", "Notes.a")).toThrow(/at most/);
    expect(() => parseRestTag("GET /a/:id", "Notes.a")).toThrow(/write path parameters as \{param\}/);
    expect(() => parseRestTag("GET /a//b", "Notes.a")).toThrow(/empty segment/);
    expect(() => parseRestTag("GET /a?x=1", "Notes.a")).toThrow(/query string/);
    expect(() => parseRestTag("GET /a/{id}.json", "Notes.a")).toThrow(/whole segment/);
  });
});

describe("parseRestClassTag (class)", () => {
  it("reads a path and normalises the leading slash", () => {
    expect(parseRestClassTag("/invoicing", "Invoices")).toEqual({ path: "/invoicing" });
    expect(parseRestClassTag("invoicing/v2", "Invoices")).toEqual({ path: "/invoicing/v2" });
    expect(parseRestClassTag("/companies/{businessId}", "Companies")).toEqual({ path: "/companies/{businessId}" });
  });

  it("rejects a method word and multiple tokens", () => {
    expect(() => parseRestClassTag("GET /x", "Invoices")).toThrow(/Invoices: a class-level @rest takes only a path/);
    expect(() => parseRestClassTag("DELETE", "Invoices")).toThrow(/takes only a path/);
  });
});

describe("@rest in source", () => {
  it("lands on the class and the methods, with {param} braces intact", () => {
    const files = analyzeSource({
      "/tools/Notes.ts": `
        /** Notes.
         * @rest /notebook
         */
        export class Notes {
          /** Reads one.
           * @rest GET /notebook/{id}
           */
          read(input: { id: string }): string { return input.id; }
          /** @rest delete */
          purge(input: { id: string }): void {}
          /** No tag. */
          plain(): void {}
        }
      `,
    });
    const cls = files.find((f) => f.path === "tools/Notes.ts")!.classes[0];
    expect(cls.rest).toEqual({ path: "/notebook" });
    const byName = Object.fromEntries(cls.functions.map((fn) => [fn.name, fn.rest]));
    expect(byName.read).toEqual({ method: "GET", path: "/notebook/{id}" });
    expect(byName.purge).toEqual({ method: "DELETE" });
    expect(byName.plain).toBeUndefined();
  });

  it("fails analysis on an invalid tag, naming the method", () => {
    expect(() =>
      analyzeSource({
        "/tools/Notes.ts": `
          export class Notes {
            /** @rest PATCH */
            fix(): void {}
          }
        `,
      })).toThrow(/Notes\.fix: @rest method "PATCH" is not supported/);
  });
});
