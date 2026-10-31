import { exampleFromSchema } from "./exampleFromSchema.ts";
import { type JsonSchema, schemaToTypeScript } from "./schemaToTypeScript.ts";

/** A tool the widget may call, surfaced to the page as a `toolcall` event. */
export interface EmbedGuideTool {
  /** Tool id. */
  id: string;
  /** Display name. */
  title?: string;
  /** What the tool does. */
  description?: string;
  /** The tool's input schema. */
  inputSchema?: JsonSchema;
}

/** Inputs of {@link buildEmbedGuide}. */
export interface EmbedGuideInput {
  /** Plugin origin, e.g. `https://salaxy-anon.vercel.app`. */
  pluginUrl: string;
  /** Plugin display title. */
  pluginTitle: string;
  /** The widget's tool id. */
  toolId: string;
  /** Widget display title. */
  title: string;
  /** What the widget shows. */
  description?: string;
  /** Input schema of the widget's tool. */
  inputSchema?: JsonSchema;
  /** Tools callable by the plugin's widgets only (`@visibility app`): the widget's events. */
  appTools?: EmbedGuideTool[];
  /** The plugin's API needs a bearer token. */
  requiresAuth?: boolean;
}

/** Copy-paste material for embedding one widget. */
export interface EmbedGuide {
  /** The input type as TypeScript. */
  inputType: string;
  /** An example input object. */
  exampleArgs: unknown;
  /** Plain HTML: the `widgets.js` script and a `<qrtl-widget>`. */
  html: string;
  /** React (`@quartal/plugin-embed/react`). */
  react: string;
  /** Vue (`@quartal/plugin-embed/vue`). */
  vue: string;
  /** A prompt for a coding agent that adds the widget to a page. */
  prompt: string;
  /** The whole guide as Markdown (served as `/widgets/<toolId>/embed.md`). */
  markdown: string;
}

const indentLines = (text: string, pad: string): string => text.split("\n").map((l, i) => (i ? pad + l : l)).join("\n");

/** The first paragraph of a description, on one line. */
function summary(text: string | undefined): string {
  return (text ?? "").trim().split(/\n\s*\n/)[0].replace(/\s+/g, " ");
}

/**
 * Builds the copy-paste material for embedding a widget in a web page: HTML, React and Vue
 * snippets, the input type, a ready-made coding-agent prompt and the whole guide as Markdown.
 * @param input Plugin, widget and tool schema details.
 */
export function buildEmbedGuide(input: EmbedGuideInput): EmbedGuide {
  const url = input.pluginUrl.replace(/\/+$/, "");
  const inputType = schemaToTypeScript(input.inputSchema ?? { type: "object", properties: {} });
  const exampleArgs = exampleFromSchema(input.inputSchema) ?? {};
  const argsJson = JSON.stringify(exampleArgs, null, 2);
  const tool = input.toolId;
  const appTools = input.appTools ?? [];

  const authHtml = input.requiresAuth
    ? `\n  // The plugin's API needs a bearer token from your own login:\n  widget.getToken = async () => yourAccessToken;`
    : "";
  const html = `<script type="module" src="${url}/widgets.js"></script>

<qrtl-widget tool="${tool}"></qrtl-widget>

<script type="module">
  const widget = document.querySelector('qrtl-widget[tool="${tool}"]');${authHtml}
  widget.args = ${indentLines(argsJson, "  ")};
  widget.addEventListener("toolcall", (e) => console.log("Widget called", e.detail.name, e.detail.args));
  widget.addEventListener("error", (e) => console.error(e.detail.message));
</script>`;

  const authProp = input.requiresAuth ? `\n      getToken={async () => yourAccessToken}` : "";
  const react = `import { PluginWidget } from "@quartal/plugin-embed/react";

export function ${pascal(tool)}Widget() {
  return (
    <PluginWidget
      url="${url}"
      tool="${tool}"${authProp}
      args={${indentLines(argsJson, "      ")}}
      onToolCall={(call) => console.log("Widget called", call.name, call.args)}
      onError={(message) => console.error(message)}
    />
  );
}`;

  const authAttr = input.requiresAuth ? `\n    :get-token="async () => yourAccessToken"` : "";
  const vue = `<script setup lang="ts">
import { PluginWidget } from "@quartal/plugin-embed/vue";

const args = ${argsJson};
</script>

<template>
  <PluginWidget
    url="${url}"
    tool="${tool}"${authAttr}
    :args="args"
    @tool-call="(call) => console.log('Widget called', call.name, call.args)"
    @error="(message) => console.error(message)"
  />
</template>`;

  const eventLines = appTools.map((t) => {
    const args = t.inputSchema ? schemaToTypeScript(t.inputSchema).replace(/\s+/g, " ") : "{}";
    const what = summary(t.description || t.title);
    return `- \`${t.id}(${args})\`${what ? ` — ${what}` : ""}`;
  });

  const prompt = [
    `Add the "${input.title}" widget from the ${input.pluginTitle} plugin (${url}) to this page.`,
    summary(input.description) ? `It shows: ${summary(input.description)}` : "",
    `Load \`<script type="module" src="${url}/widgets.js"></script>\` once and render \`<qrtl-widget tool="${tool}"></qrtl-widget>\` (in React use \`PluginWidget\` from \`@quartal/plugin-embed/react\`, in Vue \`PluginWidget\` from \`@quartal/plugin-embed/vue\`).`,
    `Set the element's \`args\` property (an object, not an attribute) to the tool input, typed:\n\n\`\`\`ts\ntype ${pascal(tool)}Input = ${inputType};\n\`\`\``,
    `Changing \`args\` calls the tool again. The element fires \`result\` (detail: the JSON result), \`error\` (detail: { message }) and \`toolcall\` (detail: { name, args, respondWith(value) }) events.`,
    eventLines.length
      ? `The widget calls these tools when the user acts in it; listen for them as \`toolcall\` events:\n\n${eventLines.join("\n")}`
      : "",
    input.requiresAuth
      ? `The plugin's API needs a bearer token: set \`widget.getToken = async () => token\` with the token of the page's own login.`
      : "",
    `Full guide: ${url}/widgets/${encodeURIComponent(tool)}/embed.md`,
  ].filter(Boolean).join("\n\n");

  const markdown = [
    `# Embed the "${input.title}" widget`,
    (input.description ?? "").trim(),
    `Plugin: ${input.pluginTitle} (${url}). Tool: \`${tool}\`.`,
    `## HTML\n\n\`\`\`html\n${html}\n\`\`\``,
    `## Input\n\nSet \`args\` (a property, or a JSON \`args\` attribute) to:\n\n\`\`\`ts\ntype ${pascal(tool)}Input = ${inputType};\n\`\`\`\n\nChanging \`args\` calls the tool again. To show a result the page already has, set \`result\` instead; the tool is then not called. The height follows the widget's content; set a \`max-height\` attribute (pixels) to limit it.`,
    `## Events\n\n| Event | \`detail\` |\n| --- | --- |\n| \`ready\` | — |\n| \`result\` | the tool's JSON result |\n| \`error\` | \`{ message }\` |\n| \`toolcall\` | \`{ name, args, respondWith(value) }\` — the widget calls a tool; call \`respondWith\` to answer it yourself |\n| \`toolresult\` | \`{ name, args, result, value?, error? }\` |\n| \`message\` | \`{ role, content }\` — the widget posts a chat message |\n| \`modelcontext\` | \`{ content?, structuredContent? }\` |`,
    eventLines.length ? `### Tools the widget calls\n\n${eventLines.join("\n")}` : "",
    `## Authentication\n\n${input.requiresAuth ? "The plugin's API needs a bearer token." : "The plugin's API is anonymous; no token is needed."} The library brings no login of its own: set \`getToken\` (a function returning the token) or \`token\` on the element, or call \`plugin.setAuth({ getToken })\` on the \`plugin\` export of \`widgets.js\`.`,
    `## React\n\n\`npm install @quartal/plugin-embed\`\n\n\`\`\`tsx\n${react}\n\`\`\``,
    `## Vue\n\n\`npm install @quartal/plugin-embed\`\n\n\`\`\`vue\n${vue}\n\`\`\``,
    `## REST\n\nThe same tool over REST, without the widget: \`connectPlugin({ url: "${url}" }).callTool("${tool}", args)\` from \`@quartal/plugin-embed\`, or the plugin's OpenAPI document at ${url}/open-api.json. The route table is at ${url}/widgets/routes.json.`,
    `## Prompt for a coding agent\n\n${prompt.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n")}`,
  ].filter(Boolean).join("\n\n") + "\n";

  return { inputType, exampleArgs, html, react, vue, prompt, markdown };
}

/**
 * The index of a plugin's embeddable widgets (served as `/widgets/embed.md`).
 * @param pluginUrl Plugin origin.
 * @param pluginTitle Plugin display title.
 * @param widgets The widgets.
 */
export function buildEmbedIndex(
  pluginUrl: string,
  pluginTitle: string,
  widgets: Array<{ toolId: string; title: string; description?: string }>,
): string {
  const url = pluginUrl.replace(/\/+$/, "");
  const lines = widgets.map((w) => {
    const what = summary(w.description);
    return `- [${w.title}](${url}/widgets/${encodeURIComponent(w.toolId)}/embed.md) — \`<qrtl-widget tool="${w.toolId}">\`${what ? `: ${what}` : ""}`;
  });
  return [
    `# Embeddable widgets of ${pluginTitle}`,
    `Load \`<script type="module" src="${url}/widgets.js"></script>\` once, then place \`<qrtl-widget tool="…">\` elements and set their \`args\`. React and Vue bindings are in the \`@quartal/plugin-embed\` npm package.`,
    lines.length ? lines.join("\n") : "This plugin has no widgets.",
  ].join("\n\n") + "\n";
}

function pascal(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""));
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
