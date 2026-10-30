import { createElement, type CSSProperties, type ReactElement, useEffect, useRef } from "react";
import type { MountedWidget, PluginAuth, WidgetCallbacks, WidgetHostContext, WidgetTheme } from "../model/index.ts";
import { delegateCallbacks } from "../client/delegateCallbacks.ts";
import { pluginConnection } from "../element/pluginRegistry.ts";

/** Props of {@link PluginWidget}. */
export interface PluginWidgetProps extends WidgetCallbacks, PluginAuth {
  /** The plugin's origin, e.g. `https://salaxy-anon.vercel.app`. */
  url: string;
  /** Id of the tool whose widget to show. */
  tool: string;
  /** The tool's input; the tool is called with it (and again when it changes). */
  args?: Record<string, unknown>;
  /** A result the page already has: shown without calling the tool. */
  result?: unknown;
  /** Color theme. Default `light`. */
  theme?: WidgetTheme;
  /** More host context (locale, display modes, styles), read when the widget mounts. */
  hostContext?: WidgetHostContext;
  /** Called with the JSON result the widget shows. */
  onResult?: (value: unknown) => void;
  /** `title` of the iframe. */
  title?: string;
  /** Class of the wrapping `<div>`. */
  className?: string;
  /** Style of the wrapping `<div>`. */
  style?: CSSProperties;
}

const dataKey = (value: unknown): string | undefined => (value === undefined ? undefined : JSON.stringify(value));

/**
 * Shows a plugin tool's widget. The widget mounts when `url` or `tool` change; new `args` call the
 * tool again, a new `result` is shown as is. Callbacks may change on every render.
 *
 * ```tsx
 * <PluginWidget url="https://salaxy-anon.vercel.app" tool="simpleSalary" args={{ rows }}
 *   onToolCall={(call) => console.log(call)} onError={setError} />
 * ```
 */
export function PluginWidget(props: PluginWidgetProps): ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<MountedWidget | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const sent = useRef<{ args?: string; result?: string }>({});
  const argsKey = dataKey(props.args ?? {});
  const resultKey = dataKey(props.result);

  useEffect(() => {
    const p = latest.current;
    const mounted = pluginConnection(p.url).mountWidget(container.current!, {
      ...delegateCallbacks(() => latest.current),
      tool: p.tool,
      args: p.args ?? {},
      ...(p.result !== undefined ? { result: p.result } : {}),
      theme: p.theme ?? "light",
      ...(p.hostContext ? { hostContext: p.hostContext } : {}),
      title: p.title ?? p.tool,
      getToken: async () => (latest.current.getToken ? await latest.current.getToken() : latest.current.token),
      onResult: (value) => latest.current.onResult?.(value),
    });
    widget.current = mounted;
    sent.current = { args: argsKey, result: resultKey };
    return () => {
      widget.current = null;
      void mounted.dispose();
    };
    // Mount again only for another plugin or tool; data changes go through update() below.
  }, [props.url, props.tool]);

  useEffect(() => {
    const mounted = widget.current;
    if (!mounted || (sent.current.args === argsKey && sent.current.result === resultKey)) return;
    sent.current = { args: argsKey, result: resultKey };
    const p = latest.current;
    mounted.update(p.result !== undefined ? { args: p.args ?? {}, result: p.result } : { args: p.args ?? {} });
  }, [argsKey, resultKey]);

  useEffect(() => {
    widget.current?.setTheme(props.theme ?? "light");
  }, [props.theme]);

  return createElement("div", { ref: container, className: props.className, style: props.style });
}
