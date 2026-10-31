import type { MountedWidget, TokenProvider, WidgetTheme, WidgetToolCall } from "../model/index.ts";
import { resolvePlugin } from "./pluginRegistry.ts";

/** Tag name of the generic widget element. */
export const WIDGET_ELEMENT_TAG = "qrtl-widget";

/** `detail` of the `toolcall` event. */
export interface ToolCallEventDetail extends WidgetToolCall {
  /**
   * Answers the call: the value (or a promise of one) becomes the tool's JSON result and the tool is
   * not run. Call it while handling the event.
   */
  respondWith(value: unknown): void;
}

/** Lets the module load where there is no DOM (server rendering); the element is only defined in a browser. */
const BaseElement = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

/**
 * `<qrtl-widget tool="…">` — shows a plugin tool's widget. Set the input with the `args` property
 * (or a JSON `args` attribute), or a result the page already has with `result`; until one is set,
 * the widget waits (a tool without input runs right away). Auth comes from the
 * `getToken` or `token` property. The plugin is the one whose `widgets.js` the page loaded, or the
 * origin in the `plugin` attribute.
 *
 * Events (not bubbling): `ready`, `result` (detail: the JSON result), `error` (detail: `{ message }`),
 * `toolcall` (detail: {@link ToolCallEventDetail}), `toolresult`, `message`, `modelcontext`.
 */
export class QrtlWidgetElement extends BaseElement {
  static observedAttributes = ["tool", "plugin", "theme", "args", "max-height"];

  /** Returns the bearer token for the plugin's API. Wins over {@link QrtlWidgetElement.token}. */
  getToken?: TokenProvider;
  /** Bearer token for the plugin's API. */
  token?: string | null;
  /**
   * Answers the widget's tool calls in code instead of an event listener. Return a value to answer
   * the call; return nothing to let the tool run.
   */
  onToolCall?: (call: WidgetToolCall) => unknown;

  #args: Record<string, unknown> | undefined;
  #result: unknown;
  #widget: MountedWidget | null = null;
  #mountedKey = "";
  #renderQueued = false;
  #container: HTMLDivElement | null = null;

  /** Tool id. */
  get tool(): string {
    return this.getAttribute("tool") ?? "";
  }
  set tool(value: string) {
    this.setAttribute("tool", value);
  }

  /** Plugin origin; optional when the page loaded exactly one plugin's `widgets.js`. */
  get plugin(): string | null {
    return this.getAttribute("plugin");
  }
  set plugin(value: string | null) {
    if (value) this.setAttribute("plugin", value);
    else this.removeAttribute("plugin");
  }

  /** Color theme (`light` or `dark`). */
  get theme(): WidgetTheme {
    return this.getAttribute("theme") === "dark" ? "dark" : "light";
  }
  set theme(value: WidgetTheme) {
    this.setAttribute("theme", value);
  }

  /**
   * Largest height in pixels (`max-height` attribute): the widget follows its content up to it and
   * scrolls inside itself beyond it. No limit when unset.
   */
  get maxHeight(): number | undefined {
    const value = Number(this.getAttribute("max-height"));
    return this.hasAttribute("max-height") && value > 0 ? value : undefined;
  }
  set maxHeight(value: number | undefined) {
    if (value === undefined) this.removeAttribute("max-height");
    else this.setAttribute("max-height", String(value));
  }

  /** The tool's input. Setting it calls the tool again. */
  get args(): Record<string, unknown> | undefined {
    return this.#args;
  }
  set args(value: Record<string, unknown> | undefined) {
    this.#args = value;
    this.#result = undefined;
    if (this.#widget) this.#widget.update({ args: value ?? {} });
    else this.#queueRender();
  }

  /** A result the page already has; shown without calling the tool. */
  get result(): unknown {
    return this.#result;
  }
  set result(value: unknown) {
    this.#result = value;
    if (this.#widget && value !== undefined) this.#widget.update({ result: value });
    else this.#queueRender();
  }

  /** The mounted widget, once there is one. */
  get widget(): MountedWidget | null {
    return this.#widget;
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (oldValue === value) return;
    if (name === "args") {
      try {
        this.args = value ? (JSON.parse(value) as Record<string, unknown>) : undefined;
      } catch {
        this.#emit("error", { message: `The args attribute of <${WIDGET_ELEMENT_TAG}> is not valid JSON.` });
      }
      return;
    }
    if (name === "theme") {
      this.#widget?.setTheme(this.theme);
      return;
    }
    if (name === "max-height") {
      this.#widget?.setMaxHeight(this.maxHeight);
      return;
    }
    this.#queueRender();
  }

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = ":host{display:block}";
      this.#container = document.createElement("div");
      root.append(style, this.#container);
    }
    this.#queueRender();
  }

  disconnectedCallback(): void {
    // A node moved within the page is disconnected and reconnected in the same task: keep it.
    queueMicrotask(() => {
      if (!this.isConnected) void this.#unmount();
    });
  }

  #emit(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /** Mounts on the next microtask, so properties set right after creation are picked up. */
  #queueRender(): void {
    if (this.#renderQueued) return;
    this.#renderQueued = true;
    queueMicrotask(() => {
      this.#renderQueued = false;
      void this.#render();
    });
  }

  async #unmount(): Promise<void> {
    const widget = this.#widget;
    this.#widget = null;
    this.#mountedKey = "";
    await widget?.dispose();
  }

  async #render(): Promise<void> {
    if (!this.isConnected || !this.#container || !this.tool) return;
    const key = `${this.plugin ?? ""} ${this.tool}`;
    if (this.#widget && key === this.#mountedKey) return;
    await this.#unmount();
    this.#mountedKey = key;
    const tool = this.tool;
    let plugin;
    try {
      plugin = await resolvePlugin(tool, this.plugin);
    } catch (error) {
      this.#emit("error", { message: error instanceof Error ? error.message : String(error) });
      return;
    }
    // A tool that takes input waits for `args`; one without input runs right away.
    let args = this.#args;
    if (args === undefined && this.#result === undefined) {
      const route = await plugin.routes().then((r) => r.tools[tool], () => undefined);
      if (route && route.inputIn === "none" && !route.pathParams.length) args = {};
    }
    if (key !== this.#mountedKey || !this.isConnected) return;

    this.#widget = plugin.mountWidget(this.#container, {
      tool,
      ...(args !== undefined ? { args } : {}),
      ...(this.#result !== undefined ? { result: this.#result } : {}),
      theme: this.theme,
      ...(this.maxHeight !== undefined ? { maxHeight: this.maxHeight } : {}),
      title: this.getAttribute("title") ?? tool,
      getToken: async () => (this.getToken ? await this.getToken() : this.token),
      onReady: () => this.#emit("ready"),
      onResult: (value) => this.#emit("result", value),
      onError: (message) => this.#emit("error", { message }),
      onToolCall: (call) => {
        let answered = false;
        let answer: unknown;
        const detail: ToolCallEventDetail = {
          ...call,
          respondWith(value) {
            answered = true;
            answer = value;
          },
        };
        this.#emit("toolcall", detail);
        if (answered) return answer;
        return this.onToolCall?.(call);
      },
      onToolResult: (result) => this.#emit("toolresult", result),
      onMessage: (message) => this.#emit("message", message),
      onModelContext: (context) => this.#emit("modelcontext", context),
    });
  }
}

/**
 * Defines `<qrtl-widget>` unless the page already has it (another plugin's `widgets.js` may have
 * defined it first; all copies share one plugin registry).
 */
export function defineWidgetElement(): void {
  if (typeof customElements === "undefined" || customElements.get(WIDGET_ELEMENT_TAG)) return;
  customElements.define(WIDGET_ELEMENT_TAG, QrtlWidgetElement);
}
