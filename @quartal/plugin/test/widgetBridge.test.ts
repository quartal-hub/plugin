import { beforeEach, describe, expect, it, vi } from "vitest";

/** The slice of the SDK's `App` the bridge uses; each test sets the host context it reports. */
const host = vi.hoisted(() => ({
  context: {} as Record<string, unknown>,
  listeners: new Map<string, (params: unknown) => void>(),
  appOptions: undefined as unknown,
  requestDisplayMode: vi.fn(async (params: { mode: string }) => ({ mode: params.mode })),
  applyDocumentTheme: vi.fn(),
}));

vi.mock("@modelcontextprotocol/ext-apps", () => ({
  App: class {
    constructor(_info: unknown, _caps: unknown, options: unknown) {
      host.appOptions = options;
    }
    addEventListener(name: string, listener: (params: unknown) => void): void {
      host.listeners.set(name, listener);
    }
    async connect(): Promise<void> {}
    getHostContext(): Record<string, unknown> {
      return host.context;
    }
    requestDisplayMode = host.requestDisplayMode;
  },
  applyDocumentTheme: host.applyDocumentTheme,
}));

const { connectWidget } = await import("../src/widget/index.ts");

beforeEach(() => {
  host.context = {};
  host.listeners.clear();
  host.requestDisplayMode.mockClear();
  host.applyDocumentTheme.mockClear();
});

describe("connectWidget", () => {
  it("reports inline and no available modes when the host says nothing", async () => {
    const bridge = await connectWidget({ name: "t" });
    expect(bridge.displayMode).toBe("inline");
    expect(bridge.availableDisplayModes).toEqual([]);
    expect(await bridge.requestDisplayMode("fullscreen")).toBe("inline");
    expect(host.requestDisplayMode).not.toHaveBeenCalled();
  });

  it("requests a display mode the host allows and reports the granted one", async () => {
    host.context = { displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"] };
    const seen: string[] = [];
    const bridge = await connectWidget({ name: "t", onDisplayMode: (mode) => seen.push(mode) });
    expect(await bridge.requestDisplayMode("fullscreen")).toBe("fullscreen");
    expect(host.requestDisplayMode).toHaveBeenCalledWith({ mode: "fullscreen" });
    expect(bridge.displayMode).toBe("fullscreen");
    expect(seen).toEqual(["inline", "fullscreen"]);
  });

  it("returns the mode the host granted when it differs from the request", async () => {
    host.context = { displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"] };
    host.requestDisplayMode.mockResolvedValueOnce({ mode: "inline" });
    const bridge = await connectWidget({ name: "t" });
    expect(await bridge.requestDisplayMode("fullscreen")).toBe("inline");
  });

  it("keeps the theme and the display state a context change does not mention", async () => {
    host.context = { theme: "dark", displayMode: "inline", availableDisplayModes: ["inline", "pip"] };
    const bridge = await connectWidget({ name: "t" });
    expect(bridge.theme).toBe("dark");

    host.listeners.get("hostcontextchanged")?.({ displayMode: "pip" });
    expect(bridge.theme).toBe("dark");
    expect(bridge.displayMode).toBe("pip");
    expect(bridge.availableDisplayModes).toEqual(["inline", "pip"]);

    host.listeners.get("hostcontextchanged")?.({ theme: "light" });
    expect(bridge.theme).toBe("light");
    expect(bridge.displayMode).toBe("pip");
  });

  it("leaves the document theme alone with applyTheme: false and passes autoResize on", async () => {
    host.context = { theme: "dark" };
    const bridge = await connectWidget({ name: "t", applyTheme: false, autoResize: false });
    expect(bridge.theme).toBe("dark");
    expect(host.applyDocumentTheme).not.toHaveBeenCalled();
    expect(host.appOptions).toEqual({ autoResize: false });
  });
});
