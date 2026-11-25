import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { buildMcpTools } from "../src/code/buildMcpTools.ts";
import { elicitForm, elicitUrl } from "../src/elicit/index.ts";
import { Helpers } from "../src/helpers/Helpers.ts";
import { getAnonApp } from "../src/index.ts";
import type { CodeFile, McpToolDescriptor, QuartalPluginContext } from "../src/index.ts";
import { analyzeSource } from "./helpers/analyzeSource.ts";

// Elicitation end to end: the code generator builds the form schema from `elicitForm<T>`, the MCP
// server answers a 2026-07-28 tools/call with `input_required`, the SDK client fulfils it through
// its elicitation handler and retries, and the REST API answers 428 and accepts the retry.

const fixtureDir = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));

const PAYMENTS_SOURCE = `
import { elicitForm, elicitUrl } from "@quartal/plugin/elicit";

/** Shown to the user before paying. */
export interface PaymentConfirmation {
  /** Account to pay from. */
  account: "operating" | "savings";
  /**
   * I have checked the amount.
   * @summary Checked
   */
  confirmed: boolean;
  /** A note for the bookkeeping. @maxLength 200 */
  note?: string;
}

/** Payments. */
export class Payments {
  /**
   * Pays an invoice after the user confirms it.
   * @param input The invoice.
   */
  async payInvoice(input: { invoiceId: string }, ctx: any): Promise<{ status: string; account?: string }> {
    const answer = await elicitForm<PaymentConfirmation>(ctx, "confirm", { message: "Pay?" });
    if (answer.action !== "accept") return { status: answer.action };
    return { status: "paid", account: answer.content.account };
  }

  /**
   * Connects the bank.
   * @param input Nothing.
   */
  async connectBank(input: { bank: string }, ctx: any): Promise<{ status: string }> {
    const answer = await elicitUrl(ctx, "bank-login", { message: "Sign in to your bank", url: "https://bank.example.com/login" });
    return { status: answer.action };
  }
}
`;

describe("elicitForm<T> — form schema from the type argument", () => {
  let files: CodeFile[];
  let tools: McpToolDescriptor[];

  beforeAll(() => {
    files = analyzeSource({ "/tools/Payments.ts": PAYMENTS_SOURCE });
    tools = buildMcpTools(files);
  });

  it("puts the restricted form schema on the tool descriptor, keyed by the literal key", () => {
    const pay = tools.find((t) => t.methodName === "payInvoice");
    expect(pay?.elicitations?.confirm).toEqual({
      type: "object",
      properties: {
        account: { type: "string", enum: ["operating", "savings"], title: "Account to pay from." },
        confirmed: { type: "boolean", title: "Checked", description: "I have checked the amount." },
        note: { type: "string", title: "A note for the bookkeeping.", maxLength: 200 },
      },
      required: ["account", "confirmed"],
    });
    expect(tools.find((t) => t.methodName === "connectBank")?.elicitations).toBeUndefined();
  });

  it("fails the build for a form type elicitation cannot express", () => {
    expect(() => analyzeSource({
      "/tools/Bad.ts": `
        import { elicitForm } from "@quartal/plugin/elicit";
        export interface Nested { address: { street: string } }
        export class Bad {
          async ask(input: { id: string }, ctx: any) { return elicitForm<Nested>(ctx, "addr", { message: "?" }); }
        }`,
    })).toThrow(/Bad\.ask elicitForm "addr" → address/);
  });
});

describe("elicitForm / elicitUrl — callers that cannot elicit", () => {
  it("resolves with the fallback (decline by default, or an error)", async () => {
    const ctx: QuartalPluginContext = { authenticated: false };
    const schema = { type: "object", properties: {} };
    expect(await elicitForm(ctx, "k", { message: "m", schema })).toEqual({ action: "decline" });
    await expect(elicitForm(ctx, "k", { message: "Confirm first", schema, fallback: "error" })).rejects.toThrow("Confirm first");
    expect(await elicitUrl(ctx, "k", { message: "m", url: "https://x.example" })).toEqual({ action: "decline" });
  });
});

describe("elicitation over MCP and REST", () => {
  let app: Hono;
  let server: { close: () => void } | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const files = analyzeSource({ "/tools/Payments.ts": PAYMENTS_SOURCE });
    // The runtime class: the same methods, calling the real elicit functions.
    class Payments {
      async payInvoice(_input: { invoiceId: string }, ctx: QuartalPluginContext) {
        const answer = await elicitForm<{ account: string }>(ctx, "confirm", { message: "Pay?" });
        if (answer.action !== "accept") return { status: answer.action };
        return { status: "paid", account: answer.content.account };
      }
      async connectBank(_input: { bank: string }, ctx: QuartalPluginContext) {
        const answer = await elicitUrl(ctx, "bank-login", { message: "Sign in", url: "https://bank.example.com/login" });
        return { status: answer.action };
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
      toolModules: { Payments: { Payments } as unknown as Record<string, unknown> },
    });
    await new Promise<void>((resolve) => {
      server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, (info: { port: number }) => {
        baseUrl = `http://127.0.0.1:${info.port}`;
        resolve();
      }) as unknown as { close: () => void };
    });
  });

  afterAll(() => server?.close());

  async function withClient<T>(
    capabilities: Record<string, unknown>,
    onElicit: ((params: Record<string, unknown>) => Record<string, unknown>) | undefined,
    fn: (client: Client) => Promise<T>,
    pin = true,
  ): Promise<T> {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client = new Client(
      { name: "elicitation-test", version: "0.0.1" },
      { capabilities, ...(pin ? { versionNegotiation: { mode: { pin: "2026-07-28" } } } : {}) },
    );
    if (onElicit) {
      client.setRequestHandler("elicitation/create", (request) => onElicit(request.params as Record<string, unknown>) as never);
    }
    await client.connect(transport);
    try {
      return await fn(client);
    } finally {
      await transport.close();
    }
  }

  it("asks with a form, and the retried call gets the answer (2026-07-28)", async () => {
    const asked: Record<string, unknown>[] = [];
    const result = await withClient(
      { elicitation: { form: {} } },
      (params) => {
        asked.push(params);
        return { action: "accept", content: { account: "savings", confirmed: true } };
      },
      (client) => client.callTool({ name: "payInvoice", arguments: { invoiceId: "inv-1" } }),
    );
    expect(asked).toHaveLength(1);
    expect(asked[0].message).toBe("Pay?");
    expect((asked[0].requestedSchema as { required: string[] }).required).toEqual(["account", "confirmed"]);
    expect(result.structuredContent).toEqual({ status: "paid", account: "savings" });
  });

  it("returns a declined answer to the tool", async () => {
    const result = await withClient(
      { elicitation: { form: {} } },
      () => ({ action: "decline" }),
      (client) => client.callTool({ name: "payInvoice", arguments: { invoiceId: "inv-1" } }),
    );
    expect(result.structuredContent).toEqual({ status: "decline" });
  });

  it("uses URL mode when the client declares it", async () => {
    const asked: Record<string, unknown>[] = [];
    const result = await withClient(
      { elicitation: { url: {} } },
      (params) => {
        asked.push(params);
        return { action: "accept" };
      },
      (client) => client.callTool({ name: "connectBank", arguments: { bank: "x" } }),
    );
    expect(asked[0]).toMatchObject({ mode: "url", url: "https://bank.example.com/login" });
    expect(result.structuredContent).toEqual({ status: "accept" });
  });

  it("falls back (decline) for a client without elicitation and for 2025-era clients", async () => {
    const modern = await withClient({}, undefined, (client) =>
      client.callTool({ name: "payInvoice", arguments: { invoiceId: "inv-1" } }));
    expect(modern.structuredContent).toEqual({ status: "decline" });
    const legacy = await withClient({ elicitation: {} }, () => ({ action: "accept" }), (client) =>
      client.callTool({ name: "payInvoice", arguments: { invoiceId: "inv-1" } }), false);
    expect(legacy.structuredContent).toEqual({ status: "decline" });
  });

  it("REST: 428 with the questions, then the retried call with the answers", async () => {
    const first = await app.request("/api/payments/pay-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Qrtl-Elicitation": "form" },
      body: JSON.stringify({ invoiceId: "inv-1" }),
    });
    expect(first.status).toBe(428);
    const body = await first.json() as { resultType: string; inputRequests: Record<string, { params: { mode: string } }> };
    expect(body.resultType).toBe("input_required");
    expect(body.inputRequests.confirm.params.mode).toBe("form");

    const answers = Buffer.from(JSON.stringify({
      confirm: { action: "accept", content: { account: "operating", confirmed: true } },
    })).toString("base64url");
    const retry = await app.request("/api/payments/pay-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Qrtl-Elicitation": "form", "Qrtl-Input-Responses": answers },
      body: JSON.stringify({ invoiceId: "inv-1" }),
    });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ status: "paid", account: "operating" });

    // Without the opt-in header the tool gets the fallback.
    const plain = await app.request("/api/payments/pay-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: "inv-1" }),
    });
    expect(await plain.json()).toEqual({ status: "decline" });
  });
});
