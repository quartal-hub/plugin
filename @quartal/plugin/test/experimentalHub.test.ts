import { FsError } from "@quartal/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPERIMENTAL_HUB_SERVICE_URLS,
  getExperimentalHubContext,
  HubApiError,
  MemoryCache,
  setPluginCache,
} from "../src/index.ts";
import type { QuartalPluginContext } from "../src/index.ts";
import { setExperimentalHubEnabled } from "../src/hub/experimentalHubServices.ts";

const ctx: QuartalPluginContext = { authenticated: true, uid: "user-1", token: "tok-1" };

interface Call {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: unknown;
}

let calls: Call[];
let respond: (call: Call) => Response;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  setPluginCache(new MemoryCache());
  setExperimentalHubEnabled(true);
  calls = [];
  respond = () => json({});
  vi.stubGlobal("fetch", async (input: URL | string, init?: RequestInit) => {
    const call: Call = {
      method: init?.method ?? "GET",
      url: new URL(String(input)),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return respond(call);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setExperimentalHubEnabled(false);
});

describe("getExperimentalHubContext", () => {
  it("is refused unless the plugin runs with auth: quartal-hub", () => {
    setExperimentalHubEnabled(false);
    expect(() => getExperimentalHubContext(ctx)).toThrow(/quartal-hub/);
  });

  it("needs a signed-in user with a token", () => {
    expect(() => getExperimentalHubContext({ authenticated: false })).toThrow(/access token/);
    expect(() => getExperimentalHubContext({ authenticated: true, uid: "u" })).toThrow(/access token/);
  });
});

describe("HubCompanies", () => {
  it("lists the user's companies from the IAM API with the user's token", async () => {
    respond = () => json({ personId: "p1", companies: [{ companyId: "c1", name: "Acme" }] });
    const companies = await getExperimentalHubContext(ctx).companies.list({ via: "direct", stats: true });
    expect(companies).toEqual([{ companyId: "c1", name: "Acme" }]);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url.origin).toBe(EXPERIMENTAL_HUB_SERVICE_URLS.iam);
    expect(calls[0].url.pathname).toBe("/api/companies");
    expect(calls[0].url.searchParams.get("via")).toBe("direct");
    expect(calls[0].url.searchParams.get("stats")).toBe("true");
    expect(calls[0].url.searchParams.has("name")).toBe(false);
    expect(calls[0].headers.Authorization).toBe("Bearer tok-1");
  });

  it("gets a company and lists an Advisory's customers", async () => {
    respond = (call) =>
      call.url.pathname.endsWith("/customers")
        ? json({ customers: [{ companyId: "k1" }], truncated: false })
        : json({ company: { companyId: "a/1" }, role: "admin", capabilities: {} });
    const hub = getExperimentalHubContext(ctx);
    expect((await hub.companies.get("a/1")).role).toBe("admin");
    expect(await hub.companies.listCustomers("a1", { query: "oy", limit: 10 })).toEqual({
      customers: [{ companyId: "k1" }],
      truncated: false,
    });
    expect(calls[0].url.pathname).toBe("/api/companies/a%2F1");
    expect(calls[1].url.pathname).toBe("/api/companies/a1/customers");
    expect(calls[1].url.searchParams.get("query")).toBe("oy");
    expect(calls[1].url.searchParams.get("limit")).toBe("10");
  });

  it("selects a company after checking the user's access, per user", async () => {
    respond = () => json({
      company: { companyId: "c1", name: "Acme", businessId: "123-4", isAccountingFirm: false },
      role: "member",
      capabilities: {},
    });
    const hub = getExperimentalHubContext(ctx);
    expect(await hub.companies.getSelected()).toBeNull();

    const selected = await hub.companies.setSelected("c1");
    expect(selected).toMatchObject({ companyId: "c1", name: "Acme", businessId: "123-4", isAccountingFirm: false });
    expect(calls[0].url.pathname).toBe("/api/companies/c1");

    // A later call of the same user sees the selection; another user does not.
    expect(await getExperimentalHubContext(ctx).companies.getSelected()).toEqual(selected);
    expect(await getExperimentalHubContext({ ...ctx, uid: "user-2" }).companies.getSelected()).toBeNull();

    expect(await hub.companies.setSelected(null)).toBeNull();
    expect(await hub.companies.getSelected()).toBeNull();
  });

  it("stores nothing when the user has no access to the company", async () => {
    respond = () => json({ error: "Forbidden: not linked to the company" }, 403);
    const hub = getExperimentalHubContext(ctx);
    const err = await hub.companies.setSelected("c9").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HubApiError);
    expect(err).toMatchObject({ status: 403, method: "GET" });
    expect((err as Error).message).toContain("Forbidden: not linked to the company");
    expect(await hub.companies.getSelected()).toBeNull();
  });
});

describe("HubSecrets", () => {
  it("lists, gets, stores and deletes the user's secrets", async () => {
    respond = (call) => {
      if (call.method === "PUT") return json({ name: "api-key", kind: "api-key", metadata: {} });
      if (call.method === "DELETE") return json({ removed: true });
      if (call.url.pathname === "/api/secrets") return json({ secrets: [{ name: "api-key" }] });
      return json({ secret: null });
    };
    const { secrets } = getExperimentalHubContext(ctx);
    expect(await secrets.list()).toEqual([{ name: "api-key" }]);
    expect(await secrets.get("missing")).toBeNull();
    expect(await secrets.put("api-key", { kind: "api-key", value: "s3cret" })).toMatchObject({ name: "api-key" });
    expect(await secrets.delete("api-key")).toBe(true);

    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
      "GET /api/secrets",
      "GET /api/secrets/missing",
      "PUT /api/secrets/api-key",
      "DELETE /api/secrets/api-key",
    ]);
    expect(calls[2].body).toEqual({ kind: "api-key", value: "s3cret" });
    expect(calls[2].headers["Content-Type"]).toBe("application/json");
  });
});

describe("HubFiles", () => {
  it("reads the selected company's files by default", async () => {
    respond = (call) => {
      if (call.url.origin === EXPERIMENTAL_HUB_SERVICE_URLS.iam) {
        return json({ company: { companyId: "c1", name: "Acme", businessId: null, isAccountingFirm: false } });
      }
      if (call.url.pathname === "/api/files/content") {
        return json({ entry: {}, encoding: "base64", content: Buffer.from("hei ä").toString("base64") });
      }
      return json({ entries: [{ path: "/data/a.md" }] });
    };
    const hub = getExperimentalHubContext(ctx);
    await hub.companies.setSelected("c1");

    expect(await hub.files.list("/data", { recursive: true })).toEqual([{ path: "/data/a.md" }]);
    const list = calls[1];
    expect(list.url.origin).toBe(EXPERIMENTAL_HUB_SERVICE_URLS.files);
    expect(list.url.pathname).toBe("/api/files");
    expect(Object.fromEntries(list.url.searchParams)).toEqual({ owner: "c1", path: "/data", recursive: "true" });
    expect(list.headers.Authorization).toBe("Bearer tok-1");

    expect(await hub.files.getText("/data/a.md")).toBe("hei ä");
    expect(calls[2].url.searchParams.get("owner")).toBe("c1");
  });

  it("uses an explicit owner, and posts the search requests", async () => {
    respond = () => json({ entries: [], matches: [] });
    const { files } = getExperimentalHubContext(ctx);
    await files.glob("**/*.md", { owner: "c2", drive: "data" });
    await files.grep("ALV", { owner: "c2", caseInsensitive: true });
    expect(calls[0]).toMatchObject({ method: "POST", body: { owner: "c2", pattern: "**/*.md", drive: "data" } });
    expect(calls[0].url.pathname).toBe("/api/files/glob");
    expect(calls[1]).toMatchObject({ method: "POST", body: { owner: "c2", query: "ALV", caseInsensitive: true } });
  });

  it("writes text and bytes, and edits files", async () => {
    respond = (call) => json(call.method === "DELETE" ? { deleted: true } : { entry: { path: "/data/x" } });
    const { files } = getExperimentalHubContext(ctx);
    await files.write("/data/a.md", "# A", { owner: "c1", ifMatch: null, message: "first" });
    await files.write("/data/b.bin", new Uint8Array([1, 2, 255]), { owner: "c1" });
    await files.mkdir("/data/notes", { owner: "c1" });
    await files.move("/data/a.md", "/data/notes/a.md", { owner: "c1" });
    await files.setProps("/data/notes/a.md", { status: "draft" }, { owner: "c1" });
    await files.delete("/data/b.bin", { owner: "c1", force: true });

    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
      "POST /api/files/write",
      "POST /api/files/write",
      "POST /api/files/mkdir",
      "POST /api/files/move",
      "POST /api/files/set-props",
      "DELETE /api/files",
    ]);
    expect(calls[0].body).toEqual({
      owner: "c1", path: "/data/a.md", content: "# A", encoding: "utf8", ifMatch: null, message: "first",
    });
    expect(calls[1].body).toMatchObject({ content: Buffer.from([1, 2, 255]).toString("base64"), encoding: "base64" });
    expect(calls[3].body).toEqual({ owner: "c1", from: "/data/a.md", to: "/data/notes/a.md" });
    expect(Object.fromEntries(calls[5].url.searchParams)).toEqual({ owner: "c1", path: "/data/b.bin", force: "true" });
  });

  it("reads the change feed after a cursor", async () => {
    respond = () => json({ changes: [{ seq: 8, op: "changed", path: "/a.md" }], cursor: 8, hasMore: false });
    const page = await getExperimentalHubContext(ctx).files.listChanges({ owner: "c1", since: 7, drive: "data" });
    expect(page.cursor).toBe(8);
    expect(calls[0].url.pathname).toBe("/api/sync/changes");
    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({ owner: "c1", since: "7", drive: "data" });
  });

  it("asks for an owner when no company is selected", async () => {
    const { files } = getExperimentalHubContext(ctx);
    await expect(files.listDrives()).rejects.toThrow(/No company selected/);
    expect(calls).toHaveLength(0);
  });
});

describe("fsSource (QFsSource)", () => {
  it("works on one company's files at /{drive}/{path} addresses", async () => {
    respond = () => json({ entry: { path: "/notes/a.md" }, created: true, unchanged: false, deduped: false });
    const fs = getExperimentalHubContext(ctx).fsSource("c1");
    const result = await fs.write("/data/notes/a.md", "# A", { ifMatch: "v1" });
    expect(result.unchanged).toBe(false);
    expect(calls[0].body).toMatchObject({ owner: "c1", path: "/data/notes/a.md", content: "# A", ifMatch: "v1" });
  });

  it("rejects with FsError codes, from the service's code or else the status", async () => {
    const fs = getExperimentalHubContext(ctx).fsSource("c1");

    respond = () => json({ error: "version mismatch", code: "ECONFLICT" }, 409);
    const conflict = await fs.write("/data/a.md", "x", { ifMatch: "old" }).catch((e: unknown) => e);
    expect(conflict).toBeInstanceOf(FsError);
    expect(conflict).toMatchObject({ code: "ECONFLICT", address: "/data/a.md" });

    respond = () => json({ error: "not found" }, 404);
    expect(await fs.stat("/data/missing.md").catch((e: unknown) => e)).toMatchObject({ code: "ENOENT" });

    respond = () => json({ error: "forbidden" }, 403);
    expect(FsError.is(await fs.list("/").catch((e: unknown) => e), "EPERM")).toBe(true);
  });

  it("rejects with an FsError when no company is selected", async () => {
    const err = await getExperimentalHubContext(ctx).fsSource().list("/").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FsError);
    expect(err).toMatchObject({ code: "EUNKNOWN" });
  });
});
