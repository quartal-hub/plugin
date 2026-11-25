import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { buildMcpTools } from "../src/code/buildMcpTools.ts";
import { offerDownload, readMcpFile, sha256Base64Url } from "../src/files/index.ts";
import type { FileStaging, McpFile } from "../src/files/index.ts";
import { Helpers } from "../src/helpers/Helpers.ts";
import { getAnonApp } from "../src/index.ts";
import type { QuartalPluginContext } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

// MCP files extension (io.modelcontextprotocol/files): McpFile arguments are marked x-mcp-file,
// received inline or through the plugin's file staging (upload_required → retry), checked, and
// read by the tool with readMcpFile; downloads ride in the result's _meta.

const fixtureDir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));
const FILES = "io.modelcontextprotocol/files";

const SOURCE = `
import type { McpFile } from "@quartal/plugin/files";

/** Statements. */
export class Statements {
  /**
   * Imports a bank statement.
   * @param input The statement.
   */
  async importStatement(input: {
    /**
     * The statement PDF.
     * @accept application/pdf
     * @maxSize 1KB
     * @requireDigest
     */
    statement: McpFile;
    /** Attachments. */
    attachments?: McpFile[];
  }, ctx: any): Promise<{ bytes: number }> {
    return { bytes: 0 };
  }
}
`;

describe("McpFile arguments in the generated schema", () => {
  it("marks the property with x-mcp-file and the file-object shape", () => {
    const [tool] = buildMcpTools(analyzeSource({ "/tools/Statements.ts": SOURCE }));
    const props = (tool.inputSchema as { properties: Record<string, Record<string, unknown>> }).properties;
    expect(props.statement["x-mcp-file"]).toEqual({ accept: ["application/pdf"], maxSize: 1024 });
    expect(props.statement.required).toEqual(["id", "mimeType", "size", "digest"]);
    expect((props.attachments.items as Record<string, unknown>)["x-mcp-file"]).toEqual({});
    expect("x-mcp-file" in tool.inputSchema).toBe(false);
  });
});

describe("files over MCP", () => {
  let app: Hono;
  const staged = new Map<string, Uint8Array>();
  const offered: string[] = [];

  const staging: FileStaging = {
    async createUpload(file) {
      const key = `k-${file.id}`;
      return { key, target: { url: `https://upload.example.com/${key}`, credentials: "omit", headers: { "Content-Type": file.mimeType } } };
    },
    async read(key) {
      return staged.get(key);
    },
  };

  beforeAll(async () => {
    process.env.QRTL_REQUEST_STATE_SECRET = "x".repeat(40);
    const files = analyzeSource({ "/tools/Statements.ts": SOURCE });
    class Statements {
      async importStatement(input: { statement: McpFile }, ctx: QuartalPluginContext) {
        const bytes = await readMcpFile(ctx, input.statement);
        offered.push(String(offerDownload(ctx, {
          name: "report.csv", mimeType: "text/csv", size: 3, url: "https://dl.example.com/r", credentials: "omit",
        })));
        return { bytes: bytes.length };
      }
    }
    app = await getAnonApp({
      pluginRootFolder: fixtureDir,
      artifacts: {
        tools: { files },
        mcpTools: { tools: buildMcpTools(files) },
        manifest: await Helpers.getPluginManifest(fixtureDir),
        auth: "anon",
        widgetResources: [],
      },
      toolModules: { Statements: { Statements } as unknown as Record<string, unknown> },
      fileStaging: staging,
    });
  });

  afterAll(() => {
    delete process.env.QRTL_REQUEST_STATE_SECRET;
  });

  let nextId = 1;
  async function rpc(method: string, params: Record<string, unknown>, clientFiles?: Record<string, unknown>) {
    const res = await app.request("/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": method,
        ...(method === "tools/call" ? { "Mcp-Name": String(params.name) } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: nextId++,
        method,
        params: {
          ...params,
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientCapabilities": clientFiles ? { extensions: { [FILES]: clientFiles } } : {},
          },
        },
      }),
    });
    return await res.json() as { result?: Record<string, any>; error?: { code: number; message: string; data?: unknown } };
  }

  const pdf = new TextEncoder().encode("%PDF-1.7");
  async function fileArg(withData: boolean): Promise<McpFile> {
    return {
      id: "f1", name: "statement.pdf", mimeType: "application/pdf", size: pdf.length,
      digest: { algorithm: "sha-256", value: await sha256Base64Url(pdf) },
      ...(withData ? { data: Buffer.from(pdf).toString("base64") } : {}),
    };
  }

  it("declares the extension in server/discover", async () => {
    const discover = await rpc("server/discover", {});
    expect(discover.result?.capabilities.extensions[FILES]).toEqual({ upload: {}, maxInlineBytes: 4 * 1024 * 1024 });
  });

  it("receives an inline file and offers a download to a client that declares download", async () => {
    const res = await rpc("tools/call", { name: "importStatement", arguments: { statement: await fileArg(true) } }, { upload: {}, download: {} });
    expect(res.result?.structuredContent).toEqual({ bytes: pdf.length });
    expect(res.result?._meta?.[FILES]?.downloads[0]).toMatchObject({ name: "report.csv", url: "https://dl.example.com/r" });
  });

  it("asks for an upload, then runs the tool with the staged bytes on the retry", async () => {
    const args = { statement: await fileArg(false) };
    const first = await rpc("tools/call", { name: "importStatement", arguments: args }, { upload: {} });
    expect(first.result?.resultType).toBe("upload_required");
    expect(first.result?.uploads).toEqual([{
      fileId: "f1", url: "https://upload.example.com/k-f1", credentials: "omit", headers: { "Content-Type": "application/pdf" },
    }]);

    // Nothing uploaded yet: the tool does not run.
    const early = await rpc("tools/call", { name: "importStatement", arguments: args, requestState: first.result?.requestState }, { upload: {} });
    expect(early.result?.isError).toBe(true);

    staged.set("k-f1", pdf);
    const retry = await rpc("tools/call", { name: "importStatement", arguments: args, requestState: first.result?.requestState }, { upload: {} });
    expect(retry.result?.structuredContent).toEqual({ bytes: pdf.length });
    expect(retry.result?._meta?.[FILES]).toBeUndefined();

    // A request state bound to other arguments is refused.
    const other = await rpc("tools/call", {
      name: "importStatement", arguments: { statement: { ...args.statement, name: "x.pdf" } }, requestState: first.result?.requestState,
    }, { upload: {} });
    expect(other.error?.code).toBe(-32602);
  });

  it("refuses bytes that do not match the digest, wrong types and missing upload capability", async () => {
    const wrong = { ...(await fileArg(true)), data: Buffer.from("%PDF-1.8").toString("base64") };
    const bad = await rpc("tools/call", { name: "importStatement", arguments: { statement: wrong } }, { upload: {} });
    expect(bad.result).toMatchObject({ isError: true });
    expect(bad.result?.content[0].text).toMatch(/SHA-256/);

    const png = { ...(await fileArg(true)), mimeType: "image/png" };
    const typed = await rpc("tools/call", { name: "importStatement", arguments: { statement: png } }, { upload: {} });
    expect(typed.result?.content[0].text).toMatch(/not one of the accepted types/);

    const noCap = await rpc("tools/call", { name: "importStatement", arguments: { statement: await fileArg(false) } });
    expect(noCap.error?.code).toBe(-32021);
  });

  it("REST: accepts inline files", async () => {
    const res = await app.request("/api/statements/import-statement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement: await fileArg(true) }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ bytes: pdf.length });
  });
});

describe("resolveToolCallFiles with a staging that confirms", () => {
  it("records the staged key instead of reading the bytes, with the call's arguments and context", async () => {
    const { resolveToolCallFiles } = await import("../src/files/resolveToolCallFiles.ts");
    const seen: { args: unknown; ctx: unknown }[] = [];
    const staging: FileStaging = {
      async createUpload(file, call) {
        seen.push({ args: call.args, ctx: call.ctx });
        return { key: `blob-${file.id}`, target: { url: "https://u.example.com/x", credentials: "omit" } };
      },
      async confirm(key) {
        return key === "blob-f1";
      },
    };
    const file = { id: "f1", mimeType: "text/plain", size: 3 };
    const args = { path: "/data/a.txt", file };
    const fileArgs = [{ name: "file", array: false }];
    const base = {
      tool: "saveFile", args, fileArgs, headers: {}, clientUpload: true, maxInlineBytes: 0, staging,
      mintState: async () => "state",
      withCall: <T>(fn: (call: { tool: string; args: Record<string, unknown>; ctx: QuartalPluginContext }) => Promise<T>) =>
        fn({ tool: "saveFile", args, ctx: { authenticated: true, uid: "u1" } }),
    };
    const first = await resolveToolCallFiles(base);
    expect(first.kind).toBe("upload");
    expect(seen[0]).toEqual({ args, ctx: { authenticated: true, uid: "u1" } });

    const state = { tool: "saveFile", args: "", principal: "", files: { f1: "blob-f1" } };
    // The hashes must match the call: mint a state the way the resolver does by reading what it bound.
    let bound: unknown;
    await resolveToolCallFiles({ ...base, mintState: async (s) => { bound = s; return "x"; } });
    const retry = await resolveToolCallFiles({ ...base, state: { ...(bound as typeof state) } });
    expect(retry).toMatchObject({ kind: "ready" });
    expect((retry as { staged: Map<string, string> }).staged.get("f1")).toBe("blob-f1");
  });
});
