import { afterEach, describe, expect, it, vi } from "vitest";
import { createWidgetHost, jsonToolResult } from "@quartal/plugin-embed";
import { connectWidget } from "../src/widget/index.ts";

/**
 * Conformance: a widget built with `connectWidget` (the real ext-apps `App`) against the
 * `@quartal/plugin-embed` host that pages embed widgets with. Two fake windows stand in for the page
 * and the iframe: `postMessage` structured-clones the payload and dispatches it asynchronously with
 * the sender as `source`.
 */
/** Messages posted between the fake windows and not yet dispatched. */
let inFlight = 0;

class FakeWindow extends EventTarget {
  peer!: FakeWindow;
  parent: FakeWindow = this;
  readonly location: { href: string };
  constructor(readonly origin: string) {
    super();
    this.location = { href: `${origin}/` };
  }
  postMessage(data: unknown, targetOrigin: string): void {
    if (targetOrigin !== "*" && targetOrigin !== this.origin) return;
    const source = this.peer;
    const cloned = structuredClone(data);
    inFlight++;
    setTimeout(() => {
      inFlight--;
      const event = new Event("message");
      Object.defineProperties(event, { data: { value: cloned }, origin: { value: source.origin }, source: { value: source } });
      this.dispatchEvent(event);
    }, 0);
  }
  open(): object {
    return {};
  }
}

function frame() {
  const page = new FakeWindow("https://page.example");
  const widget = new FakeWindow("https://plugin.example");
  page.peer = widget;
  widget.peer = page;
  widget.parent = page;
  (globalThis as { window?: unknown }).window = widget;
  const iframe = { contentWindow: widget, ownerDocument: { defaultView: page }, style: {}, src: "", srcdoc: "" } as unknown as HTMLIFrameElement;
  return { iframe };
}

/** Waits until no message is in flight across several event-loop turns (not a fixed time, which a slow CI runner can outlast). */
async function flush(): Promise<void> {
  let quietTurns = 0;
  while (quietTurns < 3) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    quietTurns = inFlight === 0 ? quietTurns + 1 : 0;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { window?: unknown }).window;
});

describe("connectWidget against the plugin-embed host", () => {
  it("receives the result, the theme and display modes, and calls tools through the page", async () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const { iframe } = frame();
    const onToolCall = vi.fn(({ args }: { args: Record<string, unknown> }) => ({ picked: args.id }));
    const host = createWidgetHost({
      iframe,
      src: "https://plugin.example/widgets/sayHello",
      toolName: "sayHello",
      toolInput: { name: "Olli" },
      toolResult: jsonToolResult({ greeting: "Hello Olli" }),
      hostContext: { theme: "dark", availableDisplayModes: ["inline", "fullscreen"] },
      onToolCall,
    });

    const results: unknown[] = [];
    const bridge = await connectWidget<{ greeting: string }>({
      name: "hello",
      autoResize: false,
      applyTheme: false,
      onResult: (r) => results.push(r),
    });
    await host.ready;
    await flush();

    expect(bridge.theme).toBe("dark");
    expect(bridge.availableDisplayModes).toEqual(["inline", "fullscreen"]);
    expect(results).toEqual([{ greeting: "Hello Olli" }]);
    expect(await bridge.callTool("pickGreeting", { id: "g1" })).toEqual({ picked: "g1" });
    expect(onToolCall).toHaveBeenCalledWith({ name: "pickGreeting", args: { id: "g1" } });
    expect(await bridge.requestDisplayMode("fullscreen")).toBe("fullscreen");

    host.sendToolResult({ isError: true, content: [{ type: "text", text: JSON.stringify({ error: "Name is required" }) }] });
    await flush();
    expect(bridge.error).toBe("Name is required");
    await host.dispose();
  });
});
