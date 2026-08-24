import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import {
  type AgentDefinition,
  type AgentsCatalogResponse,
  discoverAgents,
  getAnonApp,
  parseAgentFile,
  parseFrontmatter,
  type PluginInfo,
  resolveAgent,
  resolveAgentColor,
  resolveAgentModel,
  resolveAgentTools,
  toAgentMarkdown,
} from "../src/index.ts";

// Agents are discovered from `<plugin>/agents/*.md|json`, resolved into the host-neutral
// AgentDefinition (provider-qualified model, multi-notation color, classified tool references) and
// served at /agents/*. The committed `test1` fixture ships one JSON agent and two markdown ones.

const PKG_DIR = fileURLToPath(new URL("./fixtures/pkg/", import.meta.url));
const PLUGIN_TOOLS = ["add", "multiply", "treeSum", "sayHello", "sayHelloAdvanced"];
const PLUGIN_SKILLS = ["coin-flipper", "l33t-translator", "magic-multiplier", "qrtl-glossary", "verification-seal"];

function agentByName(agents: AgentDefinition[], name: string): AgentDefinition {
  const agent = agents.find((a) => a.name === name);
  if (!agent) throw new Error(`agent ${name} not found`);
  return agent;
}

describe("parseFrontmatter", () => {
  function fields(...lines: string[]): Record<string, unknown> {
    return parseFrontmatter(["---", ...lines, "---", "Body."].join("\n"))!.fields;
  }

  it("reads scalars, flow lists, block lists and nested maps", () => {
    expect(fields(
      "name: greeter",
      "maxTurns: 12",
      "isolation: worktree",
      "quoted: \"a: b\"",
      "skills: [one, two]",
      "tools:",
      "  - add",
      "  - Read",
      "# a comment",
      "mcpServers:",
      "  remote:",
      "    type: http",
      "    url: https://example.com/mcp",
    )).toEqual({
      name: "greeter",
      maxTurns: 12,
      isolation: "worktree",
      quoted: "a: b",
      skills: ["one", "two"],
      tools: ["add", "Read"],
      mcpServers: { remote: { type: "http", url: "https://example.com/mcp" } },
    });
  });

  it("keeps nesting inside a list of maps", () => {
    expect(fields(
      "servers:",
      "  - name: remote",
      "    url: https://one.example.com/mcp",
      "    headers:",
      "      Authorization: Bearer x",
      "  - name: second",
      "    url: https://two.example.com/mcp",
    ).servers).toEqual([
      { name: "remote", url: "https://one.example.com/mcp", headers: { Authorization: "Bearer x" } },
      { name: "second", url: "https://two.example.com/mcp" },
    ]);
  });

  it("reads block scalars, including the indent-indicator form", () => {
    expect(fields("initialPrompt: |-", "  line one", "  line two").initialPrompt).toBe("line one\nline two");
    expect(fields("description: >-", "  folded over", "  two lines").description).toBe("folded over two lines");
    expect(fields("prompt: |2", "   hello").prompt).toBe(" hello\n");
  });

  it("strips trailing comments and folds wrapped plain scalars", () => {
    expect(fields("name: greeter # the greeter", "model: sonnet")).toEqual({ name: "greeter", model: "sonnet" });
    expect(fields("description: wrapped over", "  two lines", "model: sonnet")).toEqual({
      description: "wrapped over two lines",
      model: "sonnet",
    });
  });

  it("reads nested flow collections and keeps escapes literal", () => {
    expect(fields("matrix: [[a, b], [c]]", "obj: {a: [1, 2]}")).toEqual({
      matrix: [["a", "b"], ["c"]],
      obj: { a: [1, 2] },
    });
    expect(fields(String.raw`path: "C:\\src\\plugin"`).path).toBe(String.raw`C:\src\plugin`);
  });

  it("distinguishes an empty value from an empty string", () => {
    expect(fields("tools:", "model: sonnet")).toEqual({ tools: null, model: "sonnet" });
  });

  it("throws with a line and column on malformed frontmatter", () => {
    // A missing colon no longer swallows the line: it names where the author slipped.
    expect(() => fields("name: greeter", "tools Read, Write")).toThrow(/line 2, column 1/);
    expect(() => fields('name: "greeter')).toThrow(/Missing closing .*at line \d+, column \d+/);
  });

  it("throws on duplicate keys instead of silently taking the last", () => {
    expect(() => fields("model: sonnet", "model: opus")).toThrow(/unique/i);
  });

  it("rejects frontmatter that is not a mapping", () => {
    expect(() => fields("just a bare scalar")).toThrow(/must be a mapping/);
  });

  it("returns null when there is no frontmatter block", () => {
    expect(parseFrontmatter("Just a prompt.\n")).toBeNull();
  });

  it("treats an empty frontmatter block as no fields", () => {
    expect(parseFrontmatter("---\n---\nBody.")).toEqual({ fields: {}, body: "Body." });
  });
});

describe("resolveAgentModel", () => {
  it("expands Claude aliases to a provider-qualified id", () => {
    expect(resolveAgentModel("sonnet")).toEqual({
      value: "sonnet",
      provider: "anthropic",
      model: "claude-sonnet-5",
      id: "anthropic/claude-sonnet-5",
      alias: "sonnet",
    });
  });

  it("defaults a bare model id to the Claude provider", () => {
    expect(resolveAgentModel("claude-opus-5")).toMatchObject({ provider: "anthropic", id: "anthropic/claude-opus-5" });
  });

  it("keeps an explicit provider", () => {
    expect(resolveAgentModel("openai/gpt-5.1")).toMatchObject({ provider: "openai", model: "gpt-5.1" });
  });

  it("passes `inherit` through as a flag", () => {
    expect(resolveAgentModel("inherit")).toEqual({ value: "inherit", inherit: true });
  });
});

describe("resolveAgentColor", () => {
  it("maps a Claude color to Bootstrap and CSS", () => {
    expect(resolveAgentColor("purple")).toEqual({
      value: "purple",
      claude: "purple",
      bootstrap: "secondary",
      css: "#6f42c1",
    });
  });

  it("maps a Bootstrap color back to a Claude color", () => {
    expect(resolveAgentColor("danger")).toMatchObject({ claude: "red", bootstrap: "danger" });
  });

  it("passes a raw CSS color through", () => {
    expect(resolveAgentColor("#4b0082")).toEqual({ value: "#4b0082", css: "#4b0082" });
  });
});

describe("resolveAgentTools", () => {
  it("classifies plugin, environment, MCP, pattern and unknown tools", () => {
    const refs = resolveAgentTools(
      ["add", "Read", "mcp__remote__doThing", "mcp__*", "NoSuchTool", "mcp__test1__multiply"],
      { pluginTools: PLUGIN_TOOLS, pluginServer: "test1" },
    );

    expect(refs.map((r) => r.kind)).toEqual(["plugin", "environment", "mcp", "pattern", "unknown", "plugin"]);
    expect(refs[0].toolId).toBe("add");
    expect(refs[2]).toMatchObject({ server: "remote", serverTool: "doThing" });
    expect(refs[5].toolId).toBe("multiply");
  });

  it("drops duplicates and blanks", () => {
    expect(resolveAgentTools(["Read", " Read ", "", "Grep"]).map((r) => r.name)).toEqual(["Read", "Grep"]);
  });
});

describe("resolveAgent", () => {
  it("reports unknown enum values and undeclared references instead of failing", () => {
    const file = parseAgentFile(
      [
        "---",
        "description: Broken agent.",
        "effort: turbo",
        "maxTurns: many",
        "permissionMode: yolo",
        "tools: NoSuchTool, mcp__nowhere__thing",
        "skills: [not-a-skill]",
        "mcpServers:",
        "  local:",
        "    type: stdio",
        "    command: ./run.sh",
        "---",
        "Body.",
      ].join("\n"),
      "broken.md",
    );
    const { agent, warnings } = resolveAgent(file!, {
      name: "broken",
      source: "agents/broken.md",
      pluginTools: PLUGIN_TOOLS,
      pluginSkills: PLUGIN_SKILLS,
    });

    expect(agent).not.toBeNull();
    expect(agent!.effort).toBeUndefined();
    expect(agent!.maxTurns).toBeUndefined();
    expect(agent!.permissionMode).toBeUndefined();
    expect(agent!.skills).toBeUndefined();
    expect(agent!.mcpServers).toBeUndefined();
    expect(warnings).toHaveLength(7);
  });

  it("refuses an agent without a description", () => {
    const file = parseAgentFile("---\nname: nameless\n---\nBody.", "nameless.md");
    expect(resolveAgent(file!, { name: "nameless", source: "agents/nameless.md" }).agent).toBeNull();
  });
});

describe("discoverAgents", () => {
  let agents: AgentDefinition[];
  const warnings: string[] = [];

  beforeAll(async () => {
    const catalog = await discoverAgents(PKG_DIR, "@samples/test1", {
      pluginTools: PLUGIN_TOOLS,
      pluginServer: "test1",
      pluginSkills: PLUGIN_SKILLS,
      onWarning: (m) => warnings.push(m),
    });
    agents = catalog.agents;
  });

  it("discovers markdown and JSON agents, sorted by name, with no warnings", () => {
    expect(agents.map((a) => a.name)).toEqual(["flip-reporter", "greeter", "math-tutor"]);
    expect(warnings).toEqual([]);
  });

  it("resolves the full frontmatter of a markdown agent", () => {
    const agent = agentByName(agents, "math-tutor");
    expect(agent).toMatchObject({
      model: { provider: "anthropic", model: "claude-opus-5", id: "anthropic/claude-opus-5" },
      color: { value: "primary", claude: "blue", bootstrap: "primary" },
      permissionMode: "plan",
      effort: "high",
      isolation: "worktree",
      maxTurns: 12,
      skills: ["magic-multiplier", "qrtl-glossary"],
      source: "agents/math-tutor.md",
    });
    expect(agent.tools?.map((t) => t.kind)).toEqual([
      "plugin",
      "plugin",
      "plugin",
      "environment",
      "environment",
      "mcp",
    ]);
    expect(agent.disallowedTools?.map((t) => t.name)).toEqual(["Write", "Edit", "Bash"]);
    expect(agent.mcpServers).toEqual([{
      name: "salaxy-anon",
      type: "http",
      url: "https://mcp-anon.salaxy.com/mcp",
      description: "Anonymous Salaxy salary calculation, for word problems about pay.",
    }]);
    expect(agent.prompt.startsWith("# Math tutor")).toBe(true);
  });

  it("resolves a JSON agent the same way as a markdown one", () => {
    const agent = agentByName(agents, "flip-reporter");
    expect(agent).toMatchObject({
      model: { provider: "openai", model: "gpt-5.1", id: "openai/gpt-5.1" },
      color: { value: "#4b0082", css: "#4b0082" },
      maxTurns: 4,
      source: "agents/flip-reporter.json",
    });
    expect(agent.prompt.startsWith("# Flip reporter")).toBe(true);
  });

  it("carries the initial prompt", () => {
    expect(agentByName(agents, "greeter").initialPrompt).toBe("Who should I greet?");
  });

  it("returns an empty catalog when the plugin has no agents folder", async () => {
    const catalog = await discoverAgents(join(PKG_DIR, "skills"), "@samples/test1");
    expect(catalog).toEqual({ version: "1.0", plugin: "@samples/test1", agents: [] });
  });
});

describe("discoverAgents — invalid files", () => {
  let dir: string;
  const warnings: string[] = [];

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "qrtl-agents-"));
    await mkdir(join(dir, "agents"), { recursive: true });
    await writeFile(join(dir, "agents", "no-frontmatter.md"), "Just a prompt, no frontmatter.\n");
    await writeFile(join(dir, "agents", "README.md"), "Documentation, not an agent.\n");
    await writeFile(join(dir, "agents", "Invalid Name.md"), "---\ndescription: Bad name.\n---\nBody.\n");
    await writeFile(join(dir, "agents", "ok.md"), "---\ndescription: Fine.\n---\nBody.\n");
    await writeFile(join(dir, "agents", "duplicate.md"), "---\nname: ok\ndescription: Also fine.\n---\nBody.\n");
    const catalog = await discoverAgents(dir, "@samples/tmp", { onWarning: (m) => warnings.push(m) });
    expect(catalog.agents.map((a) => a.name)).toEqual(["ok"]);
  });

  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("skips files that cannot describe an agent, with a warning each", () => {
    expect(warnings.some((w) => w.includes("no-frontmatter.md: not an agent file"))).toBe(true);
    expect(warnings.some((w) => w.includes('invalid agent name "Invalid Name"'))).toBe(true);
    expect(warnings.some((w) => w.includes('agent "ok" is already defined'))).toBe(true);
  });

  it("ignores README.md inside agents/", () => {
    expect(warnings.some((w) => w.includes("README.md"))).toBe(false);
  });
});

describe("toAgentMarkdown", () => {
  it("round-trips an agent through the Claude agent format", async () => {
    const catalog = await discoverAgents(PKG_DIR, "@samples/test1", {
      pluginTools: PLUGIN_TOOLS,
      pluginServer: "test1",
      pluginSkills: PLUGIN_SKILLS,
      onWarning: () => {},
    });
    const original = agentByName(catalog.agents, "math-tutor");
    const markdown = toAgentMarkdown(original);
    expect(markdown.startsWith("---\nname: math-tutor\n")).toBe(true);

    const reparsed = resolveAgent(parseAgentFile(markdown, "math-tutor.md")!, {
      name: "math-tutor",
      source: "agents/math-tutor.md",
      pluginTools: PLUGIN_TOOLS,
      pluginServer: "test1",
      pluginSkills: PLUGIN_SKILLS,
    });
    expect(reparsed.warnings).toEqual([]);
    // The markdown export is the Claude interchange format, so a Bootstrap color is written as its
    // Claude equivalent — the only field the round-trip does not reproduce verbatim.
    expect(reparsed.agent).toEqual({ ...original, color: { ...original.color!, value: "blue" } });
  });

  it("survives a description with backslashes and colons", () => {
    const description = String.raw`Use for C:\src\plugin: the Windows checkout.`;
    const source = ["---", "name: path-agent", `description: ${JSON.stringify(description)}`, "---", "Body."]
      .join("\n");
    const first = resolveAgent(parseAgentFile(source, "path-agent.md")!, {
      name: "path-agent",
      source: "agents/path-agent.md",
    }).agent!;
    expect(first.description).toBe(description);

    // Two more trips: escaping that is not lossless degrades a little further each time.
    let current = first;
    for (let i = 0; i < 2; i++) {
      current = resolveAgent(parseAgentFile(toAgentMarkdown(current), "path-agent.md")!, {
        name: "path-agent",
        source: "agents/path-agent.md",
      }).agent!;
    }
    expect(current).toEqual(first);
  });

  it("round-trips every agent of both sample plugins", async () => {
    for (const dir of ["../../../samples/test1", "../../../samples/salaxy-anon"]) {
      const root = fileURLToPath(new URL(`${dir}/`, import.meta.url));
      const catalog = await discoverAgents(root, "@samples/sample", { onWarning: () => {} });
      expect(catalog.agents.length).toBeGreaterThan(0);
      for (const agent of catalog.agents) {
        const reparsed = resolveAgent(parseAgentFile(toAgentMarkdown(agent), `${agent.name}.md`)!, {
          name: agent.name,
          source: agent.source,
        }).agent;
        // Color is written in its Claude notation, so `value` can differ; everything else is exact.
        expect({ ...reparsed, color: undefined }).toEqual({ ...agent, color: undefined });
      }
    }
  });
});

describe("agent routes", () => {
  let app: Hono;

  beforeAll(async () => {
    app = await getAnonApp({ pluginRootFolder: PKG_DIR, toolModules: {} });
  });

  it("serves /agents/catalog.json with enriched urls", async () => {
    const res = await app.request("/agents/catalog.json");
    expect(res.status).toBe(200);
    const catalog = await res.json() as AgentsCatalogResponse;
    expect(catalog.plugin).toBe("@samples/test1");
    expect(catalog.agents.map((a) => a.name)).toEqual(["flip-reporter", "greeter", "math-tutor"]);
    expect(catalog.agents[1].urls.markdown).toMatch(/\/agents\/greeter\.md$/);
  });

  it("serves the authored markdown for a markdown agent", async () => {
    const res = await app.request("/agents/greeter.md");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const text = await res.text();
    expect(text.startsWith("---\nname: greeter\n")).toBe(true);
  });

  it("renders Claude-format markdown for a JSON agent", async () => {
    const text = await (await app.request("/agents/flip-reporter.md")).text();
    expect(text).toContain("name: flip-reporter");
    expect(text).toContain("model: openai/gpt-5.1");
    expect(text).toContain("# Flip reporter");
  });

  it("serves the resolved definition as JSON", async () => {
    const res = await app.request("/agents/math-tutor.json");
    expect(res.status).toBe(200);
    const agent = await res.json() as AgentDefinition;
    expect(agent.model?.id).toBe("anthropic/claude-opus-5");
    expect(agent.tools?.[0]).toEqual({ name: "add", kind: "plugin", toolId: "add" });
  });

  it("404s on an unknown or unsafe agent name", async () => {
    expect((await app.request("/agents/nope.md")).status).toBe(404);
    expect((await app.request("/agents/..%2Fpackage.json")).status).toBe(404);
  });

  it("redirects /agents.html into the docs SPA", async () => {
    const res = await app.request("/agents.html?agent=greeter");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/#/agents/greeter");
  });

  it("lists agents in /plugin.json", async () => {
    const info = await (await app.request("/plugin.json")).json() as PluginInfo;
    expect(info.links.agentsCatalog).toBe("/agents/catalog.json");
    expect(info.agents.map((a) => a.name)).toEqual(["flip-reporter", "greeter", "math-tutor"]);
    expect(info.agents[1]).toMatchObject({ model: "anthropic/claude-sonnet-5", toolCount: 3 });
  });
});
