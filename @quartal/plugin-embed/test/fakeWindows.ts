import type { CallToolResult } from "../src/model/index.ts";

/**
 * A minimal browser window for running the MCP Apps protocol in Node: `postMessage` structured-clones
 * the payload and dispatches a `message` event on the target with the sender as `source` and the
 * sender's origin, asynchronously, the way browsers do. A targeted message whose origin does not
 * match the receiver is dropped.
 */
export class FakeWindow extends EventTarget {
  peer!: FakeWindow;
  parent: FakeWindow = this;
  readonly location: { href: string };
  readonly opened: string[] = [];

  constructor(public readonly origin: string) {
    super();
    this.location = { href: `${origin}/` };
  }

  postMessage(data: unknown, targetOrigin: string): void {
    if (targetOrigin !== "*" && targetOrigin !== this.origin) return;
    this.deliver(structuredClone(data), this.peer);
  }

  /** Dispatches a message as if `source` had sent it. */
  deliver(data: unknown, source: FakeWindow): void {
    setTimeout(() => {
      const event = new Event("message");
      Object.defineProperties(event, {
        data: { value: data },
        origin: { value: source.origin },
        source: { value: source },
      });
      this.dispatchEvent(event);
    }, 0);
  }

  open(url: string): object {
    this.opened.push(url);
    return {};
  }
}

/** A fake iframe hosting `widget` inside `host`. */
export interface FakeFrame {
  host: FakeWindow;
  widget: FakeWindow;
  iframe: HTMLIFrameElement;
}

/**
 * A page window and a widget window framed in it; installs the widget window as the global
 * `window`, which is where the ext-apps `App` looks for its parent.
 * @param widgetOrigin Origin of the widget page.
 */
export function createFrame(widgetOrigin = "https://plugin.example"): FakeFrame {
  const host = new FakeWindow("https://page.example");
  const widget = new FakeWindow(widgetOrigin);
  host.peer = widget;
  widget.peer = host;
  widget.parent = host;
  (globalThis as { window?: unknown }).window = widget;
  const iframe = {
    contentWindow: widget,
    ownerDocument: { defaultView: host },
    style: {} as Record<string, string>,
    src: "",
    srcdoc: "",
  } as unknown as HTMLIFrameElement;
  return { host, widget, iframe };
}

/** Resolves after pending timers and microtasks have run. */
export function flush(ms = 5): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A successful tool result carrying `value`. */
export function okResult(value: Record<string, unknown>): CallToolResult {
  return { structuredContent: value, content: [{ type: "text", text: JSON.stringify(value) }] };
}
