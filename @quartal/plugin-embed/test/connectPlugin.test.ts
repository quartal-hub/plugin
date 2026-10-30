import { App } from "@modelcontextprotocol/ext-apps";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildToolRequest } from "../src/client/buildToolRequest.ts";
import { connectPlugin } from "../src/client/connectPlugin.ts";
import { PluginToolError } from "../src/client/PluginToolError.ts";
import type { WidgetRoutes } from "../src/model/index.ts";
import { createFrame, flush } from "./fakeWindows.ts";

const routes: WidgetRoutes = {
  name: "hello",
  tools: {
    sayHello: { method: "POST", path: "/api/hello-world/say-hello", pathParams: [], inputIn: "body" },
    getInvoice: { method: "GET", path: "/api/invoices/{id}", pathParams: ["id"], inputIn: "query" },
    deleteAll: { method: "DELETE", path: "/api/things", pathParams: [], inputIn: "none" },
  },
  widgets: { sayHello: { path: "/widgets/sayHello", title: "Say hello" } },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.restoreAllMocks());

describe("buildToolRequest", () => {
  it("sends POST input as the JSON body", () => {
    expect(buildToolRequest("https://p.example", routes.tools.sayHello, { name: "Olli" })).toEqual({
      url: "https://p.example/api/hello-world/say-hello",
      method: "POST",
      body: '{"name":"Olli"}',
    });
  });

  it("fills path parameters and sends the rest as the query string", () => {
    const request = buildToolRequest("https://p.example", routes.tools.getInvoice, { id: "a/b", full: true, tags: ["x", "y"], skip: undefined });
    expect(request).toEqual({ url: "https://p.example/api/invoices/a%2Fb?full=true&tags=x&tags=y", method: "GET" });
  });

  it("rejects a missing path parameter", () => {
    expect(() => buildToolRequest("https://p.example", routes.tools.getInvoice, {})).toThrow(/Missing path parameter "id"/);
  });

  it("sends nothing for a route without input", () => {
    expect(buildToolRequest("https://p.example", routes.tools.deleteAll, {})).toEqual({ url: "https://p.example/api/things", method: "DELETE" });
  });
});

describe("connectPlugin", () => {
  it("loads the route table once and calls tools over REST with a bearer token", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/widgets/routes.json")) return jsonResponse(routes);
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer t1");
      return jsonResponse({ greeting: `Hello ${JSON.parse(String(init?.body)).name}` });
    });
    const plugin = connectPlugin({ url: "https://p.example/some/page", getToken: () => "t1", fetch });
    expect(plugin.url).toBe("https://p.example");
    expect(await plugin.callTool("sayHello", { name: "A" })).toEqual({ greeting: "Hello A" });
    expect(await plugin.callTool("sayHello", { name: "B" })).toEqual({ greeting: "Hello B" });
    expect(fetch.mock.calls.filter(([u]) => String(u).endsWith("routes.json"))).toHaveLength(1);
    expect(await plugin.widgetUrl("sayHello")).toBe("https://p.example/widgets/sayHello");
  });

  it("prefers per-call auth and sends no header without a token", async () => {
    const seen: Array<string | undefined> = [];
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string>).authorization);
      return jsonResponse({});
    });
    const plugin = connectPlugin({ url: "https://p.example", routes, fetch });
    await plugin.callTool("sayHello", {});
    await plugin.callTool("sayHello", {}, { token: "call" });
    plugin.setAuth({ token: "conn" });
    await plugin.callTool("sayHello", {});
    await plugin.callTool("sayHello", {}, { getToken: () => undefined });
    expect(seen).toEqual([undefined, "Bearer call", "Bearer conn", "Bearer conn"]);
  });

  it("rejects with the plugin's error message and status", async () => {
    const fetch = vi.fn(async () => jsonResponse({ error: "Name is required" }, 500));
    const plugin = connectPlugin({ url: "https://p.example", routes, fetch });
    const error = await plugin.callTool("sayHello", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PluginToolError);
    expect(error).toMatchObject({ message: "Name is required", status: 500 });
    expect(await plugin.callToolResult("sayHello", {})).toEqual({ isError: true, content: [{ type: "text", text: "Name is required" }] });
  });

  it("rejects an unknown tool", async () => {
    const plugin = connectPlugin({ url: "https://p.example", routes, fetch: vi.fn() });
    await expect(plugin.callTool("nope")).rejects.toThrow(/no REST route for tool "nope"/);
    await expect(plugin.widgetUrl("deleteAll")).rejects.toThrow(/no widget/);
  });

  it("retries a route table that failed to load", async () => {
    let calls = 0;
    const fetch = vi.fn(async () => (++calls === 1 ? new Response("down", { status: 503 }) : jsonResponse(routes)));
    const plugin = connectPlugin({ url: "https://p.example", fetch });
    await expect(plugin.routes()).rejects.toThrow(/503/);
    expect((await plugin.routes()).name).toBe("hello");
  });
});

describe("mountWidget", () => {
  function mountTarget() {
    const frame = createFrame();
    const iframe = Object.assign(frame.iframe, {
      setAttribute: vi.fn(),
      remove: vi.fn(),
      className: "",
      title: "",
      style: { cssText: "" } as Record<string, string>,
    });
    const container = {
      ownerDocument: { createElement: () => iframe },
      appendChild: vi.fn(),
    } as unknown as Element;
    return { frame, iframe, container };
  }

  it("calls the tool, loads the widget page and hands the widget input and result", async () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const { iframe, container } = mountTarget();
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => jsonResponse({ greeting: `Hello ${JSON.parse(String(init?.body)).name}` }));
    const plugin = connectPlugin({ url: "https://plugin.example", routes, fetch });
    const onResult = vi.fn();
    const widget = plugin.mountWidget(container, { tool: "sayHello", args: { name: "Olli" }, onResult });
    expect(container.appendChild).toHaveBeenCalledWith(iframe);
    await flush();
    expect(iframe.src).toBe("https://plugin.example/widgets/sayHello");

    const inputs: unknown[] = [];
    const results: unknown[] = [];
    const app = new App({ name: "w", version: "1" }, {}, { autoResize: false });
    app.addEventListener("toolinput", (p) => inputs.push(p.arguments));
    app.addEventListener("toolresult", (p) => results.push(p.structuredContent));
    await app.connect();
    await widget.ready;
    await flush();
    expect(inputs).toEqual([{ name: "Olli" }]);
    expect(results).toEqual([{ greeting: "Hello Olli" }]);
    expect(onResult).toHaveBeenCalledWith({ greeting: "Hello Olli" });

    widget.update({ args: { name: "Ada" } });
    await flush();
    expect(inputs).toEqual([{ name: "Olli" }, { name: "Ada" }]);
    expect(results.at(-1)).toEqual({ greeting: "Hello Ada" });

    widget.update({ result: { greeting: "Given" } });
    await flush();
    expect(results.at(-1)).toEqual({ greeting: "Given" });
    expect(fetch).toHaveBeenCalledTimes(2);

    // The widget's own tool call goes to the REST route.
    const own = await app.callServerTool({ name: "sayHello", arguments: { name: "Self" } });
    expect(own.structuredContent).toEqual({ greeting: "Hello Self" });

    await app.close();
    await widget.dispose();
    expect(iframe.remove).toHaveBeenCalled();
  });

  it("shows a given result without calling the tool, and reports a failed call", async () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const { container } = mountTarget();
    const fetch = vi.fn(async () => jsonResponse({ error: "Nope" }, 422));
    const plugin = connectPlugin({ url: "https://plugin.example", routes, fetch });
    const onError = vi.fn();
    const widget = plugin.mountWidget(container, { tool: "sayHello", result: { greeting: "Hi" }, onError });
    const app = new App({ name: "w", version: "1" }, {}, { autoResize: false });
    const results: unknown[] = [];
    app.addEventListener("toolresult", (p) => results.push(p.isError ? "error" : p.structuredContent));
    await flush();
    await app.connect();
    await widget.ready;
    await flush();
    expect(results).toEqual([{ greeting: "Hi" }]);
    expect(fetch).not.toHaveBeenCalled();

    widget.update({ args: { name: "x" } });
    await flush();
    expect(results.at(-1)).toBe("error");
    expect(onError).toHaveBeenCalledWith("Nope");
    await app.close();
    await widget.dispose();
  });
});
