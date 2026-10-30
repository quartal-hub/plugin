import { defineComponent, h, onBeforeUnmount, onMounted, type PropType, ref, watch } from "vue";
import type {
  MountedWidget,
  TokenProvider,
  WidgetCallbacks,
  WidgetHostContext,
  WidgetTheme,
} from "../model/index.ts";
import { delegateCallbacks } from "../client/delegateCallbacks.ts";
import { pluginConnection } from "../element/pluginRegistry.ts";

type Callback<K extends keyof WidgetCallbacks> = PropType<NonNullable<WidgetCallbacks[K]>>;

const dataKey = (value: unknown): string | undefined => (value === undefined ? undefined : JSON.stringify(value));

/**
 * Shows a plugin tool's widget. The widget mounts again when `url` or `tool` change; new `args` call
 * the tool again, a new `result` is shown as is. Callbacks are props, so `@tool-call` can return an
 * answer to the widget's tool call.
 *
 * ```vue
 * <PluginWidget url="https://salaxy-anon.vercel.app" tool="simpleSalary" :args="{ rows }"
 *   @tool-call="(call) => console.log(call)" @error="(m) => (error = m)" />
 * ```
 */
export const PluginWidget = defineComponent({
  name: "PluginWidget",
  props: {
    /** The plugin's origin. */
    url: { type: String, required: true },
    /** Id of the tool whose widget to show. */
    tool: { type: String, required: true },
    /** The tool's input; the tool is called with it (and again when it changes). */
    args: { type: Object as PropType<Record<string, unknown>>, default: undefined },
    /** A result the page already has: shown without calling the tool. */
    result: { type: null as unknown as PropType<unknown>, default: undefined },
    /** Color theme. */
    theme: { type: String as PropType<WidgetTheme>, default: "light" },
    /** More host context, read when the widget mounts. */
    hostContext: { type: Object as PropType<WidgetHostContext>, default: undefined },
    /** Bearer token for the plugin's API. */
    token: { type: String as PropType<string | null>, default: undefined },
    /** Returns the bearer token; wins over `token`. */
    getToken: { type: Function as PropType<TokenProvider>, default: undefined },
    /** `title` of the iframe. */
    title: { type: String, default: undefined },
    onReady: { type: Function as Callback<"onReady">, default: undefined },
    onToolCall: { type: Function as Callback<"onToolCall">, default: undefined },
    onToolResult: { type: Function as Callback<"onToolResult">, default: undefined },
    onMessage: { type: Function as Callback<"onMessage">, default: undefined },
    onModelContext: { type: Function as Callback<"onModelContext">, default: undefined },
    onOpenLink: { type: Function as Callback<"onOpenLink">, default: undefined },
    onDisplayMode: { type: Function as Callback<"onDisplayMode">, default: undefined },
    onSize: { type: Function as Callback<"onSize">, default: undefined },
    onLog: { type: Function as Callback<"onLog">, default: undefined },
    onError: { type: Function as Callback<"onError">, default: undefined },
    onResult: { type: Function as PropType<(value: unknown) => void>, default: undefined },
  },
  setup(props) {
    const container = ref<HTMLDivElement | null>(null);
    let widget: MountedWidget | null = null;
    let sent: { args?: string; result?: string } = {};

    const mount = (): void => {
      if (!container.value) return;
      widget = pluginConnection(props.url).mountWidget(container.value, {
        ...delegateCallbacks(() => props),
        tool: props.tool,
        args: props.args ?? {},
        ...(props.result !== undefined ? { result: props.result } : {}),
        theme: props.theme,
        ...(props.hostContext ? { hostContext: props.hostContext } : {}),
        title: props.title ?? props.tool,
        getToken: async () => (props.getToken ? await props.getToken() : props.token),
        onResult: (value) => props.onResult?.(value),
      });
      sent = { args: dataKey(props.args ?? {}), result: dataKey(props.result) };
    };
    const unmount = (): void => {
      void widget?.dispose();
      widget = null;
    };

    onMounted(mount);
    onBeforeUnmount(unmount);
    watch(() => [props.url, props.tool], () => {
      unmount();
      mount();
    });
    watch(
      () => [dataKey(props.args ?? {}), dataKey(props.result)] as const,
      ([args, result]) => {
        if (!widget || (sent.args === args && sent.result === result)) return;
        sent = { args, result };
        widget.update(props.result !== undefined ? { args: props.args ?? {}, result: props.result } : { args: props.args ?? {} });
      },
    );
    watch(() => props.theme, (theme) => widget?.setTheme(theme));

    return () => h("div", { ref: container });
  },
});
