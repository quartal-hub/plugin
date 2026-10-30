import { describe, expect, it } from "vitest";
import { buildEmbedGuide, buildEmbedIndex, exampleFromSchema, schemaToTypeScript } from "../src/guide/index.ts";

const inputSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Who to greet." },
    times: { type: "integer" },
    mood: { type: "string", enum: ["happy", "sad"] },
    tags: { type: "array", items: { type: "string" } },
    "odd-key": { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["name"],
};

describe("schemaToTypeScript", () => {
  it("renders an object schema with optional properties and doc comments", () => {
    expect(schemaToTypeScript(inputSchema)).toBe(`{
  /** Who to greet. */
  name: string;
  times?: number;
  mood?: "happy" | "sad";
  tags?: string[];
  "odd-key"?: string | null;
}`);
  });

  it("falls back to unknown and Record types", () => {
    expect(schemaToTypeScript(undefined)).toBe("unknown");
    expect(schemaToTypeScript({ type: "object" })).toBe("Record<string, unknown>");
    expect(schemaToTypeScript({ type: "object", additionalProperties: { type: "number" } })).toBe("Record<string, number>");
    expect(schemaToTypeScript({ $ref: "#/$defs/Row" })).toBe("Row");
  });
});

describe("exampleFromSchema", () => {
  it("fills every property with a typed placeholder or the declared example", () => {
    expect(exampleFromSchema({ ...inputSchema, properties: { ...inputSchema.properties, name: { type: "string", examples: ["Olli"] } } }))
      .toEqual({ name: "Olli", times: 0, mood: "happy", tags: [""], "odd-key": "" });
  });
});

describe("buildEmbedGuide", () => {
  const guide = buildEmbedGuide({
    pluginUrl: "https://hello.example/",
    pluginTitle: "Hello",
    toolId: "sayHello",
    title: "Say hello",
    description: "A greeting card.",
    inputSchema,
    appTools: [{ id: "selectGreeting", description: "The user picks a greeting.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } }],
    requiresAuth: true,
  });

  it("builds HTML, React and Vue snippets against the plugin", () => {
    expect(guide.html).toContain('<script type="module" src="https://hello.example/widgets.js"></script>');
    expect(guide.html).toContain('<qrtl-widget tool="sayHello"></qrtl-widget>');
    expect(guide.html).toContain("widget.getToken");
    expect(guide.react).toContain('import { PluginWidget } from "@quartal/plugin-embed/react";');
    expect(guide.react).toContain("export function SayHelloWidget()");
    expect(guide.vue).toContain('import { PluginWidget } from "@quartal/plugin-embed/vue";');
  });

  it("writes a prompt with the input type, the widget's tool calls and the guide URL", () => {
    expect(guide.prompt).toContain("type SayHelloInput = {");
    expect(guide.prompt).toContain("`selectGreeting({ id: string; })` — The user picks a greeting.");
    expect(guide.prompt).toContain("https://hello.example/widgets/sayHello/embed.md");
    expect(guide.markdown).toMatch(/^# Embed the "Say hello" widget/);
    expect(guide.markdown).toContain("> Add the \"Say hello\" widget");
  });

  it("lists the widgets in the index", () => {
    expect(buildEmbedIndex("https://hello.example", "Hello", [{ toolId: "sayHello", title: "Say hello" }]))
      .toContain("[Say hello](https://hello.example/widgets/sayHello/embed.md)");
  });
});
