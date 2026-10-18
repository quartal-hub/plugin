import { fileURLToPath } from "node:url";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, describe, expect, it } from "vitest";

import {
  buildOpenApiDocument,
  PluginApiHelper,
  prepareCodeFilesForPlugin,
  resolveRestRoutes,
  splitLeadingVerb,
  toKebabCase,
} from "../src/index.ts";
import type { CodeFile, PluginManifest, RestRoute } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

const manifest: PluginManifest = {
  name: "@test/pkg",
  title: "Test Pkg",
  description: "test",
  version: "1.0.0",
  style: { logo: "", icons: [{ src: "https://cdn.example/icon.png", sizes: ["128x128"] }] },
  imports: {},
};

/** Analyzes the source the way the build does: with the system wrapper types (`VoidValue`, …) included. */
function analyze(source: string, fileName = "Things"): CodeFile[] {
  return prepareCodeFilesForPlugin(analyzeSource({ [`/tools/${fileName}.ts`]: source }));
}

/** Routes of the given source as `"Class.method": "METHOD /path"`. */
function routesOf(source: string, fileName = "Things"): Record<string, string> {
  const routes = resolveRestRoutes(analyze(source, fileName));
  return Object.fromEntries([...routes].map(([key, r]) => [key, `${r.method} ${r.path}`]));
}

function routeOf(source: string, key: string): RestRoute {
  const route = resolveRestRoutes(analyze(source)).get(key);
  if (!route) throw new Error(`no route for ${key}`);
  return route;
}

describe("toKebabCase / splitLeadingVerb", () => {
  it("kebab-cases class and method names", () => {
    expect(toKebabCase("HelloWorld")).toBe("hello-world");
    expect(toKebabCase("getHTTPStatus")).toBe("get-http-status");
    expect(toKebabCase("v2_report")).toBe("v2-report");
    expect(toKebabCase("Invoices")).toBe("invoices");
    expect(toKebabCase("sayHello")).toBe("say-hello");
  });

  it("recognises a leading verb only at a word boundary", () => {
    expect(splitLeadingVerb("getInvoice")).toEqual({ verb: "get", rest: "Invoice" });
    expect(splitLeadingVerb("get")).toEqual({ verb: "get", rest: "" });
    expect(splitLeadingVerb("list_all")).toEqual({ verb: "list", rest: "all" });
    expect(splitLeadingVerb("listen")).toBeUndefined();
    expect(splitLeadingVerb("settle")).toBeUndefined();
    expect(splitLeadingVerb("sayHello")).toBeUndefined();
  });
});

describe("resolveRestRoutes — naming convention", () => {
  it("maps a CRUD class to resource routes without any tags", () => {
    expect(routesOf(`
      export class Invoices {
        list(input: { page?: number }): string[] { return []; }
        get(input: { id: string }): string { return input.id; }
        create(input: { customer: string }): string { return ""; }
        update(input: { id: string; customer: string }): string { return ""; }
        delete(input: { id: string }): boolean { return true; }
        approve(input: { id: string }): string { return ""; }
        search(input: { filters: string[] }): string[] { return []; }
      }
    `, "Invoices")).toEqual({
      "Invoices.list": "GET /api/invoices",
      "Invoices.get": "GET /api/invoices/{id}",
      "Invoices.create": "POST /api/invoices",
      "Invoices.update": "PUT /api/invoices/{id}",
      "Invoices.delete": "DELETE /api/invoices/{id}",
      "Invoices.approve": "POST /api/invoices/approve",
      "Invoices.search": "POST /api/invoices/search",
    });
  });

  it("drops a remainder that names the class (singular or plural) and keeps every other remainder", () => {
    expect(routesOf(`
      export class Invoices {
        listInvoices(): string[] { return []; }
        getInvoice(input: { id: number }): string { return ""; }
        createInvoice(input: { customer: string }): string { return ""; }
        getStats(): string { return ""; }
        findOverdue(input: { days: number }): string[] { return []; }
        removeAttachment(input: { id: string; file: string }): void {}
      }
    `, "Invoices")).toEqual({
      "Invoices.listInvoices": "GET /api/invoices",
      "Invoices.getInvoice": "GET /api/invoices/{id}",
      "Invoices.createInvoice": "POST /api/invoices",
      "Invoices.getStats": "GET /api/invoices/stats",
      "Invoices.findOverdue": "GET /api/invoices/overdue",
      "Invoices.removeAttachment": "DELETE /api/invoices/attachment/{id}",
    });
    expect(routesOf(`
      export class Invoice {
        listInvoices(): string[] { return []; }
      }
    `, "Invoice")).toEqual({ "Invoice.listInvoices": "GET /api/invoice" });
  });

  it("binds a required primitive `id` to the path for GET, PUT and DELETE only", () => {
    const routes = routesOf(`
      export class Things {
        get(input: { id?: string }): string { return ""; }
        findById(input: { id: number }): string { return ""; }
        deleteThingById(input: { id: string }): void {}
        create(input: { id: string; name: string }): string { return ""; }
        update(input: { id: string | null; name: string }): string { return ""; }
      }
    `);
    expect(routes["Things.get"]).toBe("GET /api/things");
    expect(routes["Things.findById"]).toBe("GET /api/things/{id}");
    expect(routes["Things.deleteThingById"]).toBe("DELETE /api/things/{id}");
    expect(routes["Things.create"]).toBe("POST /api/things");
    expect(routes["Things.update"]).toBe("PUT /api/things");
  });

  it("requires an `id` property for a ...ById name", () => {
    expect(() => routesOf(`
      export class Things {
        findById(input: { key: string }): string { return ""; }
      }
    `)).toThrow(/Things\.findById: a "\.\.\.ById" method needs a required string, number or boolean input property named "id"/);
  });

  it("treats a verb inside a word, and an unknown verb, as a custom POST method", () => {
    expect(routesOf(`
      export class Things {
        listen(): void {}
        sayHello(input: { name: string }): string { return ""; }
        patchThing(input: { id: string }): string { return ""; }
      }
    `)).toEqual({
      "Things.listen": "POST /api/things/listen",
      "Things.sayHello": "POST /api/things/say-hello",
      "Things.patchThing": "POST /api/things/patch-thing",
    });
  });

  it("reports where the input travels", () => {
    const source = `
      export interface Named { name: string }
      export interface Thing extends Named { id: string; size?: number }
      export class Things {
        list(_input: void): string[] { return []; }
        getSession(_input: any): string { return ""; }
        getToken(_input: null): string { return ""; }
        get(input: { id: string }): string { return ""; }
        update(input: Thing): string { return ""; }
        create(input: Named): string { return ""; }
        delete(input: { id: string; force?: boolean }): void {}
        ping(): string { return ""; }
      }
    `;
    expect(routeOf(source, "Things.list")).toMatchObject({ method: "GET", pathParams: [], inputIn: "none" });
    expect(routeOf(source, "Things.getSession")).toMatchObject({ method: "GET", path: "/api/things/session", inputIn: "none" });
    expect(routeOf(source, "Things.getToken")).toMatchObject({ method: "GET", inputIn: "none" });
    expect(routeOf(source, "Things.get")).toMatchObject({ pathParams: ["id"], inputIn: "none" });
    expect(routeOf(source, "Things.update")).toMatchObject({ method: "PUT", path: "/api/things/{id}", pathParams: ["id"], inputIn: "body" });
    expect(routeOf(source, "Things.create")).toMatchObject({ pathParams: [], inputIn: "body" });
    expect(routeOf(source, "Things.delete")).toMatchObject({ pathParams: ["id"], inputIn: "query" });
    expect(routeOf(source, "Things.ping")).toMatchObject({ method: "POST", inputIn: "body" });
  });
});

describe("resolveRestRoutes — @rest tags", () => {
  it("uses the class path for every method, including convention routes", () => {
    expect(routesOf(`
      /** @rest notebook */
      export class Notes {
        list(): string[] { return []; }
        get(input: { id: string }): string { return ""; }
        archive(input: { id: string }): void {}
      }
    `, "Notes")).toEqual({
      "Notes.list": "GET /api/notebook",
      "Notes.get": "GET /api/notebook/{id}",
      "Notes.archive": "POST /api/notebook/archive",
    });
  });

  it("applies method tags: method only, relative path, absolute path, path only", () => {
    expect(routesOf(`
      export class Invoices {
        /** @rest DELETE */
        purgeOld(input: { id: string }): void {}
        /** @rest DELETE old */
        purgeOlder(input: { days: number }): void {}
        /** @rest DELETE /api/maintenance/old */
        purgeOldest(): void {}
        /** @rest old/{year} */
        archiveYear(input: { year: number; dryRun?: boolean }): void {}
        /** @rest POST */
        getReport(input: { filters: string[] }): string { return ""; }
      }
    `, "Invoices")).toEqual({
      "Invoices.purgeOld": "DELETE /api/invoices/purge-old/{id}",
      "Invoices.purgeOlder": "DELETE /api/invoices/old",
      "Invoices.purgeOldest": "DELETE /api/maintenance/old",
      "Invoices.archiveYear": "POST /api/invoices/old/{year}",
      "Invoices.getReport": "POST /api/invoices/report",
    });
  });

  it("requires a leading-slash path to start with the base path, on classes and methods", () => {
    expect(() => routesOf(`
      /** @rest /invoicing */
      export class Invoices {
        list(): string[] { return []; }
      }
    `, "Invoices")).toThrow(
      'Invoices: @rest path "/invoicing" must start with the API base path "/api" (as in "/api/invoicing"), or leave out the leading "/" for a path relative to /api',
    );
    expect(() => routesOf(`
      export class Invoices {
        /** @rest GET /invoices/stats */
        stats(): string { return ""; }
      }
    `, "Invoices")).toThrow(
      'Invoices.stats: @rest path "/invoices/stats" must start with the API base path "/api" (as in "/api/invoices/stats"), or leave out the leading "/" for a path relative to /api/invoices',
    );
  });

  it("validates path parameters declared in a class path against every method", () => {
    expect(routesOf(`
      /** @rest /api/companies/{businessId} */
      export class Companies {
        getNotices(input: { businessId: string; lang?: "fi" | "sv" }): string[] { return []; }
      }
    `, "Companies")).toEqual({ "Companies.getNotices": "GET /api/companies/{businessId}/notices" });
    expect(() => routesOf(`
      /** @rest companies/{businessId} */
      export class Companies {
        getNotices(input: { lang?: string }): string[] { return []; }
      }
    `, "Companies")).toThrow(/Companies\.getNotices: path parameter \{businessId\} .* is not a property of the input object/);
  });

  it("rejects an optional, nullable or non-primitive path parameter", () => {
    expect(() => routesOf(`
      export class Things {
        /** @rest GET /api/things/{id} */
        read(input: { id?: string }): string { return ""; }
      }
    `)).toThrow(/Things\.read: path parameter \{id\} must be a required, non-null string, number or boolean \(input property "id" is string, optional\)/);
    expect(() => routesOf(`
      export class Things {
        /** @rest GET things/{ref} */
        read(input: { ref: { id: string } }): string { return ""; }
      }
    `)).toThrow(/input property "ref" is an object/);
  });

  it("rejects non-primitive and nullable query input on GET and DELETE, pointing at POST", () => {
    expect(() => routesOf(`
      export class Things {
        list(input: { tags: string[] }): string[] { return []; }
      }
    `)).toThrow(/Things\.list: GET sends the input as query parameters, so every property must be a string, number or boolean \(property "tags" is an array\); use @rest POST for richer input/);
    expect(() => routesOf(`
      export class Things {
        delete(input: { id: string; reason: string | null }): void {}
      }
    `)).toThrow(/property "reason" is string, nullable/);
    expect(() => routesOf(`
      export interface Filter { name: string }
      export class Things {
        find(input: { filter: Filter }): string[] { return []; }
      }
    `)).toThrow(/property "filter" is Filter/);
  });

  it("accepts string-literal unions and enum aliases as query values", () => {
    expect(routesOf(`
      export type Lang = "fi" | "sv";
      export class Things {
        list(input: { lang?: "fi" | "sv" | "en"; alias?: Lang; flag?: boolean }): string[] { return []; }
      }
    `)).toEqual({ "Things.list": "GET /api/things" });
  });

  it("fails on a duplicate route, naming both methods", () => {
    expect(() => routesOf(`
      export class Things {
        createThing(input: { name: string }): string { return ""; }
        postThing(input: { name: string }): string { return ""; }
      }
    `)).toThrow(/Things\.postThing: REST route POST \/api\/things is already used by Things\.createThing/);
    expect(() => routesOf(`
      export class Things {
        /** @rest POST /api/things */
        createThing(input: { name: string }): string { return ""; }
        /** @rest POST /api/things */
        addThing(input: { name: string }): string { return ""; }
      }
    `)).toThrow(/Things\.addThing: REST route POST \/api\/things is already used by Things\.createThing/);
  });
});

describe("OpenAPI document", () => {
  let doc: { paths: Record<string, Record<string, { parameters?: { name: string; in: string; required?: boolean; schema: Record<string, unknown> }[]; requestBody?: unknown }>> };

  beforeAll(() => {
    const files: CodeFile[] = analyze(`
        export class Things {
          list(input: { page?: number; archived?: boolean }): string[] { return []; }
          get(input: { id: number }): string { return ""; }
          getStats(): string { return ""; }
          update(input: { id: number; name: string }): string { return ""; }
        }
      `);
    doc = buildOpenApiDocument(files, manifest) as typeof doc;
  });

  it("describes path parameters as required and typed, and query parameters as optional", () => {
    const get = doc.paths["/api/things/{id}"].get;
    expect(get.parameters).toEqual([
      expect.objectContaining({ name: "id", in: "path", required: true, schema: expect.objectContaining({ type: "number" }) }),
    ]);
    const list = doc.paths["/api/things"].get;
    expect(list.parameters?.map((p) => [p.name, p.in, p.required, p.schema.type])).toEqual([
      ["page", "query", false, "number"],
      ["archived", "query", false, "boolean"],
    ]);
    expect(list.requestBody).toBeUndefined();
  });

  it("keeps a path parameter out of the PUT body", () => {
    const put = doc.paths["/api/things/{id}"].put;
    const body = put.requestBody as { content: { "application/json": { schema: { properties: Record<string, unknown>; required: string[] } } } };
    expect(Object.keys(body.content["application/json"].schema.properties)).toEqual(["name"]);
    expect(put.parameters?.map((p) => p.name)).toEqual(["id"]);
  });

  it("lists a literal sibling and a {param} route side by side", () => {
    expect(Object.keys(doc.paths).sort()).toEqual(["/api/things", "/api/things/stats", "/api/things/{id}"]);
  });
});

describe("serving the routes (fixture plugin with the Invoices class)", () => {
  const fixtureDir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));
  const calls: Record<string, unknown>[] = [];
  const record = (method: string) => (input: Record<string, unknown>) => {
    calls.push({ method, ...input });
    return { ok: method, input };
  };
  class Invoices {
    list = record("list");
    get = record("get");
    create = record("create");
    update = record("update");
    delete = record("delete");
    approve = record("approve");
    listArchive = record("listArchive");
  }
  let app: OpenAPIHono;

  beforeAll(async () => {
    const helper = new PluginApiHelper("/api", {
      pluginRootFolder: fixtureDir,
      toolModules: { Invoices: { Invoices } as unknown as Record<string, unknown> },
    });
    await helper.init();
    app = helper.getApiApp();
  });

  const json = (body: unknown) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("GET with coerced query parameters", async () => {
    const res = await app.request("/api/invoices?page=2&status=open");
    expect(res.status).toBe(200);
    expect((await res.json()).input).toEqual({ page: 2, status: "open" });
  });

  it("GET and DELETE with the id from the path", async () => {
    expect((await (await app.request("/api/invoices/inv-1")).json()).input).toEqual({ id: "inv-1" });
    const del = await app.request("/api/invoices/inv-2", { method: "DELETE" });
    expect(del.status).toBe(200);
    expect((await del.json()).input).toEqual({ id: "inv-2" });
  });

  it("POST with the body, PUT with the body plus the id from the path", async () => {
    const post = await app.request("/api/invoices", { method: "POST", ...json({ customer: "Ada", total: 10 }) });
    expect((await post.json()).input).toEqual({ customer: "Ada", total: 10 });
    const put = await app.request("/api/invoices/inv-3", { method: "PUT", ...json({ customer: "Ada", total: 12, paid: true }) });
    expect(put.status).toBe(200);
    expect((await put.json()).input).toEqual({ id: "inv-3", customer: "Ada", total: 12, paid: true });
  });

  it("custom method stays POST at its own name", async () => {
    const res = await app.request("/api/invoices/approve", { method: "POST", ...json({ id: "inv-4" }) });
    expect((await res.json()).input).toEqual({ id: "inv-4" });
  });

  it("tagged relative path with a numeric path parameter and a query parameter", async () => {
    const res = await app.request("/api/invoices/archive/2024?customer=Ada");
    expect(res.status).toBe(200);
    expect((await res.json()).input).toEqual({ year: 2024, customer: "Ada" });
  });

  it("rejects a non-numeric path or query value with 422", async () => {
    expect((await app.request("/api/invoices/archive/last-year")).status).toBe(422);
    expect((await app.request("/api/invoices?page=two")).status).toBe(422);
  });

  it("documents every route in /open-api.json with the right method", async () => {
    const doc = await (await app.request("/open-api.json")).json() as { paths: Record<string, Record<string, unknown>> };
    expect(Object.keys(doc.paths["/api/invoices"]).sort()).toEqual(["get", "post"]);
    expect(Object.keys(doc.paths["/api/invoices/{id}"]).sort()).toEqual(["delete", "get", "put"]);
    expect(Object.keys(doc.paths["/api/invoices/archive/{year}"])).toEqual(["get"]);
  });
});
