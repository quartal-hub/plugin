import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { PluginApiHelper } from "../src/index.ts";

// Uses @samples/test1's committed qrtl-plugin (routes + Zod validation from tools.json, read via
// Node fs) and an inline tool-module registry for execution — proving the ported Hono runtime serves
// a real REST tool call end-to-end under Node, with no running server.

const test1Dir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

// A local stand-in for @samples/test1/tools/Calculator.ts (matches its generated schema).
class Calculator {
  static add(input: { first: number; second: number }): number {
    return input.first + input.second;
  }
}

let app: OpenAPIHono;

beforeAll(async () => {
  const helper = new PluginApiHelper("/api", {
    pluginRootFolder: test1Dir,
    // registry maps fileName -> module namespace (which exports the class)
    toolModules: { Calculator: { Calculator } as unknown as Record<string, unknown> },
  });
  await helper.init();
  app = helper.getApiApp();
});

describe("PluginApiHelper — request serving (app.fetch)", () => {
  it("executes a REST tool call and wraps the primitive result", async () => {
    const res = await app.request("/api/Calculator/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first: 2, second: 3 }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ value: 5 });
  });

  it("rejects invalid input with 422 (Zod validation from the generated schema)", async () => {
    const res = await app.request("/api/Calculator/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first: "not-a-number" }),
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Validation failed");
  });

  it("serves /open-api.json with a path per tool method", async () => {
    const res = await app.request("/open-api.json");
    expect(res.status).toBe(200);
    const doc = await res.json() as { paths: Record<string, unknown> };
    expect(doc.paths["/api/Calculator/add"]).toBeDefined();
  });

  it("serves /types.json and /readme.md", async () => {
    expect((await app.request("/types.json")).status).toBe(200);
    expect((await app.request("/readme.md")).status).toBe(200);
  });

  it("returns a helpful error when a tool's module is absent from the registry", async () => {
    // HelloWorld has a route (from tools.json) but is not in the injected registry.
    const res = await app.request("/api/HelloWorld/sayHello", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("Tool module not found");
  });
});
