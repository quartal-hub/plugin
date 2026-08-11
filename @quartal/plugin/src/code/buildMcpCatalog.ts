import type { CodeFile, McpCatalog, McpCatalogEntry, WidgetCatalogEntry } from "@quartal/plugin-core";
import { buildMcpTools } from "./buildMcpTools.ts";

/** Builds a read-only MCP catalog (no JSON Schemas — see `mcp-tools.json` for execution).
 * @param codeFiles Analyzed code files containing MCP tool classes.
 * @param widgetEntries Optional widget catalog entries to include.
 */
export function buildMcpCatalog(codeFiles: CodeFile[], widgetEntries?: WidgetCatalogEntry[]): McpCatalog {
  const tools = buildMcpTools(codeFiles).map((t) => ({
    id: t.id,
    name: t.id,
    className: t.className,
    methodName: t.methodName,
    ...(t.title ? { title: t.title } : {}),
    description: t.description,
  }));

  const widgets: McpCatalogEntry[] = (widgetEntries ?? []).map((w) => ({
    name: w.name,
    title: w.toolId,
    description: `MCP widget UI for the \`${w.toolId}\` tool.`,
  }));

  return {
    tools,
    resources: [],
    prompts: [],
    widgets,
  };
}
