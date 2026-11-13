import { describe, expect, it } from "vitest";

import { ZodBuilder } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

const SOURCES = {
  "/tools/FooTools.ts": `
    export class FooTools {
      foo(input: { x: string | number; y?: number | boolean }): string {
        return "";
      }
    }
  `,
};

describe("unions of built-in types", () => {
  const input = () => {
    const fn = new ZodBuilder(analyzeSource(SOURCES)).getZodsForAllFunctions().find((f) => f.fn.name === "foo");
    return fn!.input;
  };

  it("accepts a value of one of the union's types", () => {
    expect(input().safeParse({ x: "a" }).success).toBe(true);
    expect(input().safeParse({ x: 42 }).success).toBe(true);
    expect(input().safeParse({ x: "a", y: 3 }).success).toBe(true);
    expect(input().safeParse({ x: "a", y: false }).success).toBe(true);
  });

  it("rejects a value of any other type", () => {
    expect(input().safeParse({ x: true }).success).toBe(false);
    expect(input().safeParse({ x: { nested: 1 } }).success).toBe(false);
    expect(input().safeParse({ x: "a", y: "many" }).success).toBe(false);
  });
});
