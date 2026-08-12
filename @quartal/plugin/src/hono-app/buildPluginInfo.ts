import type {
  CodeArrayType,
  CodeFile,
  CodeOrSystemType,
  CodePropOrParam,
  CodeType,
  PluginManifest,
  McpCatalogEntry,
  McpPromptDescriptor,
  McpToolDescriptor,
  PluginInfo,
  PluginLinks,
  PluginPromptEntry,
  PluginSkillSummary,
  PluginToolEntry,
  PluginToolGroup,
  PluginToolParameter,
  PluginWidgetEntry,
  WidgetCatalogEntry,
} from "../model/index.ts";
import { discoverSkills } from "./skillDiscovery.ts";
import { resolveHomepage } from "./pluginMetadata.ts";

// NOTE: the serve-time `buildPluginInfoResponse` (needs the runtime PluginApiHelper) is intentionally
// not part of this build-time port; it returns with the Hono app in a later migration phase.

/** Inputs for {@link buildPluginInfo} — everything needed to assemble the overview. */
export interface BuildPluginInfoInput {
  /** Plugin manifest metadata. */
  manifest: PluginManifest;
  /** Analyzed code files (excluding the system types file is fine; it is skipped). */
  codeFiles: CodeFile[];
  /** MCP tool descriptors (from mcp-tools.json or `buildMcpTools`). */
  mcpTools: McpToolDescriptor[];
  /** MCP resources exposed by the plugin. */
  resources: McpCatalogEntry[];
  /** MCP prompt descriptors (from mcp-prompts.json or `buildMcpPrompts`). */
  prompts: McpPromptDescriptor[];
  /** Widget catalog entries (tool ids that have a UI). */
  widgetCatalog: WidgetCatalogEntry[];
  /** Skill summaries discovered under `skills/`. */
  skills: PluginSkillSummary[];
  /** REST base path (e.g. `/api`). */
  basePath: string;
  /** Default HTTP method for REST routes. */
  defaultMethod: "get" | "post";
  /** Whether a README.md is available. */
  hasReadme: boolean;
  /** Server origin for homepage resolution (omit at build time). */
  origin?: string;
}

function fileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const last = normalized.split("/").pop() ?? "";
  return last.endsWith(".ts") ? last.slice(0, -3) : last;
}

function typeNameFromCodeOrSystem(t: CodeOrSystemType): string {
  if (typeof t === "string") return t.trim();
  if (typeof t === "object" && t !== null && "name" in t) return (t as CodeType).name;
  if (typeof t === "object" && t !== null && "items" in t) {
    return `${typeNameFromCodeOrSystem((t as CodeArrayType).items)}[]`;
  }
  return "unknown";
}

function toToolParameter(p: CodePropOrParam): PluginToolParameter {
  return {
    name: p.name,
    description: p.description,
    type: typeNameFromCodeOrSystem(p.type),
    ...(p.optional ? { optional: true } : {}),
    ...(p.nullable ? { nullable: true } : {}),
  };
}

function buildTools(input: BuildPluginInfoInput): PluginToolEntry[] {
  const mcpByMethod = new Map(input.mcpTools.map((t) => [`${t.className}.${t.methodName}`, t]));
  const widgetToolIds = new Set(input.widgetCatalog.map((w) => w.toolId));
  const tools: PluginToolEntry[] = [];

  for (const file of input.codeFiles) {
    if (file.path === "__system__.ts") continue;
    const fileName = fileNameFromPath(file.path);
    for (const cls of file.classes) {
      for (const fn of cls.functions) {
        const mcp = mcpByMethod.get(`${cls.name}.${fn.name}`);
        const mcpName = mcp?.id;
        tools.push({
          name: fn.name,
          className: cls.name,
          fileName,
          ...(fn.summary ? { summary: fn.summary } : {}),
          description: fn.description,
          parameters: fn.parameters.map(toToolParameter),
          returns: toToolParameter(fn.returns),
          exposure: {
            ...(mcpName ? { mcpName } : {}),
            restUrl: `${input.basePath}/${cls.name}/${fn.name}`,
            restMethod: input.defaultMethod,
          },
          hasWidget: mcpName ? widgetToolIds.has(mcpName) : false,
        });
      }
    }
  }

  return tools;
}

function buildToolGroups(tools: PluginToolEntry[]): PluginToolGroup[] {
  const byClass = new Map<string, PluginToolGroup>();
  for (const tool of tools) {
    let group = byClass.get(tool.className);
    if (!group) {
      group = { className: tool.className, fileName: tool.fileName, tools: [] };
      byClass.set(tool.className, group);
    }
    group.tools.push(tool);
  }
  return [...byClass.values()].sort((a, b) => a.className.localeCompare(b.className));
}

function buildPrompts(prompts: McpPromptDescriptor[]): PluginPromptEntry[] {
  return prompts.map((p) => ({
    name: p.id,
    className: p.className,
    fileName: p.fileName,
    methodName: p.methodName,
    ...(p.title ? { summary: p.title } : {}),
    description: p.description,
    arguments: p.arguments,
  }));
}

function buildWidgets(input: BuildPluginInfoInput): PluginWidgetEntry[] {
  const mcpById = new Map(input.mcpTools.map((t) => [t.id, t]));
  return input.widgetCatalog.map((w) => {
    const mcp = mcpById.get(w.toolId);
    return {
      name: w.name,
      title: mcp?.title ?? w.toolId,
      description: mcp?.description ?? `MCP widget UI for the \`${w.toolId}\` tool.`,
      toolId: w.toolId,
      resourceUri: `ui://widgets/${w.toolId}.html`,
    };
  });
}

/** Discovers skills under `baseDir/skills/` and summarizes them for the overview.
 * @param baseDir Plugin root directory.
 * @param pluginName Plugin name (for the skills catalog manifest).
 */
export async function buildSkillSummaries(baseDir: string, pluginName: string): Promise<PluginSkillSummary[]> {
  const catalog = await discoverSkills(baseDir, pluginName);
  return catalog.skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    ...(skill.license ? { license: skill.license } : {}),
    ...(skill.compatibility ? { compatibility: skill.compatibility } : {}),
    ...(skill.metadata ? { metadata: skill.metadata } : {}),
    fileCount: skill.files.length,
  }));
}

function defaultLinks(): PluginLinks {
  return {
    openApi: "/open-api.json",
    types: "/types.json",
    mcpServer: "/mcp-server.json",
    skillsCatalog: "/skills/catalog.json",
    readme: "/readme.md",
    api: "/api",
    mcp: "/mcp",
  };
}

/** Assembles the unified plugin overview (the `contents.json` document).
 *
 * Pure and synchronous: the same builder is used at build time (codegen writes `contents.json`)
 * and, later, at serve time (`GET /plugin.json`). The generated file is named `contents.json`
 * to avoid confusion with a Node `package.json`.
 * @param input All metadata needed to assemble the overview.
 */
export function buildPluginInfo(input: BuildPluginInfoInput): PluginInfo {
  const { manifest, origin } = input;
  const tools = buildTools(input);
  const homepage = resolveHomepage(manifest, origin);

  return {
    name: manifest.name,
    title: manifest.title,
    description: manifest.description,
    version: manifest.version,
    ...(homepage ? { homepage } : {}),
    ...(manifest.license ? { license: manifest.license } : {}),
    ...(manifest.repository ? { repository: manifest.repository } : {}),
    style: manifest.style,
    hasReadme: input.hasReadme,
    tools,
    toolGroups: buildToolGroups(tools),
    skills: input.skills,
    widgets: buildWidgets(input),
    resources: input.resources,
    prompts: buildPrompts(input.prompts),
    links: defaultLinks(),
  };
}
