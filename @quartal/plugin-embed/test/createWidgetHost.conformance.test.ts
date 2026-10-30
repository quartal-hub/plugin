import { App } from "@modelcontextprotocol/ext-apps";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWidgetHost, type WidgetHostOptions } from "../src/host/createWidgetHost.ts";
import { closeApp, createFrame, flush, okResult, type FakeFrame } from "./fakeWindows.ts";

/**
 * Conformance: the real `@modelcontextprotocol/ext-apps` `App` (what `@quartal/plugin/widget`'s
 * `connectWidget` runs in every widget) talks to the lite host. A protocol change in ext-apps shows
 * up here as a failing test.
 */

let frame: FakeFrame;
let app: App;

function host(options: Partial<WidgetHostOptions> = {}) {
  return createWidgetHost({ iframe: frame.iframe, src: "https://plugin.example/widgets/sayHello", toolName: "sayHello", ...options });
}

async function connectApp(): Promise<App> {
  app = new App({ name: "test-widget", version: "1.0.0" }, {}, { autoResize: false });
  await app.connect();
  return app;
}

beforeEach(() => {
  vi.spyOn(console, "debug").mockImplementation(() => undefined);
  frame = createFrame();
});

afterEach(async () => {
  await closeApp(app);
  vi.restoreAllMocks();
});

describe("createWidgetHost against the ext-apps App", () => {
  it("completes the handshake with host info, capabilities and context", async () => {
    const onReady = vi.fn();
    const h = host({ hostContext: { theme: "dark", locale: "fi-FI" }, onReady });
    await connectApp();
    await h.ready;
    expect(frame.iframe.src).toBe("https://plugin.example/widgets/sayHello");
    expect(app.getHostVersion()?.name).toBe("QuartalPluginEmbed");
    expect(app.getHostCapabilities()?.serverTools).toBeDefined();
    expect(app.getHostContext()).toMatchObject({ theme: "dark", locale: "fi-FI", displayMode: "inline" });
    expect(onReady).toHaveBeenCalledOnce();
  });

  it("delivers the tool input and result after the handshake", async () => {
    const inputs: unknown[] = [];
    const results: unknown[] = [];
    host({ toolInput: { name: "Olli" }, toolResult: okResult({ greeting: "Hello Olli" }) });
    app = new App({ name: "test-widget", version: "1.0.0" }, {}, { autoResize: false });
    app.addEventListener("toolinput", (p) => inputs.push(p.arguments));
    app.addEventListener("toolresult", (p) => results.push(p.structuredContent));
    await app.connect();
    await flush();
    expect(inputs).toEqual([{ name: "Olli" }]);
    expect(results).toEqual([{ greeting: "Hello Olli" }]);
  });

  it("sends later input, results, cancellations and context changes", async () => {
    const h = host();
    const seen: string[] = [];
    app = new App({ name: "test-widget", version: "1.0.0" }, {}, { autoResize: false });
    app.addEventListener("toolinput", () => seen.push("input"));
    app.addEventListener("toolresult", (p) => seen.push(p.isError ? "error" : "result"));
    app.addEventListener("toolcancelled", () => seen.push("cancelled"));
    app.addEventListener("hostcontextchanged", (p) => seen.push(`theme:${p.theme}`));
    await app.connect();
    await h.ready;
    h.sendToolInput({ name: "A" });
    h.sendToolResult(okResult({ ok: true }));
    h.sendToolResult({ isError: true, content: [{ type: "text", text: "boom" }] });
    h.sendToolCancelled("stopped");
    h.setTheme("dark");
    await flush();
    expect(seen).toEqual(["input", "result", "error", "cancelled", "theme:dark"]);
    expect(app.getHostContext()?.theme).toBe("dark");
  });

  it("keeps what changes while the handshake is in flight", async () => {
    const h = host({ toolResult: okResult({ n: 1 }) });
    const results: unknown[] = [];
    app = new App({ name: "test-widget", version: "1.0.0" }, {}, { autoResize: false });
    app.addEventListener("toolresult", (p) => results.push(p.structuredContent));
    await app.connect();
    // The host has answered ui/initialize but has not seen ui/notifications/initialized yet.
    h.setTheme("dark");
    h.sendToolResult(okResult({ n: 2 }));
    await h.ready;
    await flush();
    expect(app.getHostContext()?.theme).toBe("dark");
    expect(results).toEqual([{ n: 2 }]);
  });

  it("reports an error result through onError", async () => {
    const onError = vi.fn();
    host({ toolResult: { isError: true, content: [{ type: "text", text: JSON.stringify({ error: "Bad input" }) }] }, onError });
    await connectApp();
    await flush();
    expect(onError).toHaveBeenCalledWith("Bad input");
  });

  it("runs the widget's tool calls through callTool", async () => {
    const callTool = vi.fn(async () => okResult({ id: 7 }));
    const onToolResult = vi.fn();
    host({ callTool, onToolResult });
    await connectApp();
    const result = await app.callServerTool({ name: "createThing", arguments: { title: "x" } });
    expect(result.structuredContent).toEqual({ id: 7 });
    expect(callTool).toHaveBeenCalledWith("createThing", { title: "x" }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(onToolResult).toHaveBeenCalledWith(expect.objectContaining({ name: "createThing", value: { id: 7 } }));
  });

  it("lets onToolCall answer a call without running the tool", async () => {
    const callTool = vi.fn();
    host({ callTool, onToolCall: ({ name, args }) => (name === "selectEmployee" ? { selected: args.id } : undefined) });
    await connectApp();
    const result = await app.callServerTool({ name: "selectEmployee", arguments: { id: "e1" } });
    expect(result.structuredContent).toEqual({ selected: "e1" });
    expect(callTool).not.toHaveBeenCalled();
  });

  it("turns failures and rejections into isError results", async () => {
    host({
      onToolCall: ({ name }) => {
        if (name === "forbidden") throw new Error("Not allowed");
      },
      callTool: async () => {
        throw new Error("Network down");
      },
    });
    await connectApp();
    const rejected = await app.callServerTool({ name: "forbidden", arguments: {} });
    expect(rejected).toMatchObject({ isError: true, content: [{ type: "text", text: "Not allowed" }] });
    const failed = await app.callServerTool({ name: "other", arguments: {} });
    expect(failed).toMatchObject({ isError: true, content: [{ type: "text", text: "Network down" }] });
  });

  it("fails tool calls when the host has no callTool", async () => {
    host();
    await connectApp();
    const result = await app.callServerTool({ name: "anything", arguments: {} });
    expect(result.isError).toBe(true);
  });

  it("handles links, messages and model context", async () => {
    const onMessage = vi.fn();
    const onModelContext = vi.fn();
    host({ onMessage, onModelContext });
    await connectApp();
    await app.openLink({ url: "https://example.com/doc" });
    expect(frame.host.opened).toEqual(["https://example.com/doc"]);
    await app.sendMessage({ role: "user", content: [{ type: "text", text: "Hi" }] });
    expect(onMessage).toHaveBeenCalledWith({ role: "user", content: [{ type: "text", text: "Hi" }] });
    await app.updateModelContext({ structuredContent: { selected: 3 } });
    expect(onModelContext).toHaveBeenCalledWith({ structuredContent: { selected: 3 } });
  });

  it("uses onOpenLink instead of opening a window", async () => {
    const onOpenLink = vi.fn();
    host({ onOpenLink });
    await connectApp();
    await app.openLink({ url: "https://example.com" });
    expect(onOpenLink).toHaveBeenCalledWith("https://example.com");
    expect(frame.host.opened).toEqual([]);
  });

  it("grants only the available display modes by default", async () => {
    const h = host({ hostContext: { availableDisplayModes: ["inline", "fullscreen"] } });
    await connectApp();
    expect((await app.requestDisplayMode({ mode: "pip" })).mode).toBe("inline");
    expect((await app.requestDisplayMode({ mode: "fullscreen" })).mode).toBe("fullscreen");
    await flush();
    expect(h.hostContext.displayMode).toBe("fullscreen");
    expect(app.getHostContext()?.displayMode).toBe("fullscreen");
  });

  it("lets onDisplayMode decide", async () => {
    host({ onDisplayMode: () => "pip" });
    await connectApp();
    expect((await app.requestDisplayMode({ mode: "fullscreen" })).mode).toBe("pip");
  });

  it("follows the widget's size and forwards logs", async () => {
    const onSize = vi.fn();
    const onLog = vi.fn();
    host({ onSize, onLog });
    await connectApp();
    await app.sendSizeChanged({ width: 300, height: 412.4 });
    await app.sendLog({ level: "warning", logger: "w", data: "careful" });
    await flush();
    expect(frame.iframe.style.height).toBe("413px");
    expect(onSize).toHaveBeenCalledWith({ width: 300, height: 412.4 });
    expect(onLog).toHaveBeenCalledWith({ level: "warning", source: "w", data: "careful" });
  });

  it("keeps the iframe height with autoResize false", async () => {
    host({ autoResize: false });
    await connectApp();
    await app.sendSizeChanged({ width: 300, height: 400 });
    await flush();
    expect(frame.iframe.style.height).toBeUndefined();
  });

  it("asks the widget to tear down on dispose", async () => {
    const h = host();
    await connectApp();
    await h.ready;
    const teardown = vi.fn(() => ({}));
    app.onteardown = teardown;
    await h.dispose();
    expect(teardown).toHaveBeenCalledOnce();
  });

  it("aborts a running tool call the widget cancels", async () => {
    let signal: AbortSignal | undefined;
    host({
      callTool: (_name, _args, options) => {
        signal = options.signal;
        return new Promise(() => undefined);
      },
    });
    await connectApp();
    const controller = new AbortController();
    const call = app.callServerTool({ name: "slow", arguments: {} }, { signal: controller.signal });
    await flush();
    controller.abort();
    await expect(call).rejects.toThrow();
    await flush();
    expect(signal?.aborted).toBe(true);
  });

  it("strips reactive proxies from what it sends", async () => {
    const results: unknown[] = [];
    const proxied = new Proxy({ a: 1 }, {});
    const h = host();
    app = new App({ name: "test-widget", version: "1.0.0" }, {}, { autoResize: false });
    app.addEventListener("toolresult", (p) => results.push(p.structuredContent));
    await app.connect();
    h.sendToolResult(okResult(proxied));
    await flush();
    expect(results).toEqual([{ a: 1 }]);
  });
});

describe("createWidgetHost message filtering", () => {
  it("ignores messages from another window or origin", async () => {
    const onReady = vi.fn();
    const h = host({ onReady });
    const initialize = { jsonrpc: "2.0", id: 1, method: "ui/initialize", params: { protocolVersion: "2026-01-26", appInfo: { name: "x", version: "1" }, appCapabilities: {} } };
    const replies: unknown[] = [];
    frame.widget.addEventListener("message", (e) => replies.push((e as MessageEvent).data));

    // Right window, wrong origin.
    const impostor = Object.assign(Object.create(frame.widget), { origin: "https://evil.example" });
    frame.host.deliver(initialize, impostor);
    // Right origin, wrong window.
    const { widget: stranger } = createFrame();
    frame.host.deliver(initialize, stranger);
    await flush();
    expect(replies).toEqual([]);
    expect(onReady).not.toHaveBeenCalled();
    await h.dispose();
  });

  it("answers an older protocol version with that version", async () => {
    host();
    const replies: Array<{ result?: { protocolVersion?: string } }> = [];
    frame.widget.addEventListener("message", (e) => replies.push((e as MessageEvent).data));
    frame.host.deliver({ jsonrpc: "2.0", id: 1, method: "ui/initialize", params: { protocolVersion: "2025-11-21", appInfo: { name: "x", version: "1" }, appCapabilities: {} } }, frame.widget);
    frame.host.deliver({ jsonrpc: "2.0", id: 2, method: "ui/initialize", params: { protocolVersion: "1999-01-01", appInfo: { name: "x", version: "1" }, appCapabilities: {} } }, frame.widget);
    await flush();
    expect(replies.map((r) => r.result?.protocolVersion)).toEqual(["2025-11-21", "2026-01-26"]);
  });

  it("answers an unknown request with method-not-found", async () => {
    host();
    const replies: Array<{ error?: { code: number } }> = [];
    frame.widget.addEventListener("message", (e) => replies.push((e as MessageEvent).data));
    frame.host.deliver({ jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri: "ui://x" } }, frame.widget);
    await flush();
    expect(replies[0].error?.code).toBe(-32601);
  });

  it("writes html into srcdoc and accepts any origin from the iframe", async () => {
    const h = createWidgetHost({ iframe: frame.iframe, html: "<p>hi</p>", toolName: "t" });
    expect(frame.iframe.srcdoc).toBe("<p>hi</p>");
    await connectApp();
    await h.ready;
  });
});
