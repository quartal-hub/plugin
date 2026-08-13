import type { CodeFile, McpToolDescriptor } from "@quartal/plugin-core";
import { buildTypeIndex } from "./buildTypeIndex.ts";
import { buildToolInputSchema, buildToolOutputSchema } from "./jsonSchemaFromCode.ts";

/** Sanitized MCP tool name (`^[a-zA-Z0-9_-]{1,128}$`).
 * @param className Source class name.
 * @param methodName Source method name.
 * @param methodNameUsed Whether the method name alone is already unique within the plugin.
 */
export function makeMcpToolName(
  className: string,
  methodName: string,
  methodNameUsed: boolean,
): string {
  const base = methodNameUsed ? `${className}_${methodName}` : methodName;
  const cleaned = base.replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned.length > 128 ? cleaned.slice(0, 128) : cleaned;
}

/** Builds the MCP tool list from code files (same shape as `mcp-tools.json`).
 * @param codeFiles Analyzed code files containing MCP tool classes.
 */
export function buildMcpTools(codeFiles: CodeFile[]): McpToolDescriptor[] {
  const typeIndex = buildTypeIndex(codeFiles);
  const toolIds: McpToolDescriptor[] = [];
  const usedNames = new Set<string>();

  for (const file of codeFiles) {
    if (file.path === "__system__.ts") continue;
    const fileName = file.path.replace(/\.ts$/, "").replace(/^.*[/\\]/, "");
    for (const cls of file.classes) {
      for (const fn of cls.functions) {
        const functionNameUsed = usedNames.has(fn.name);
        const id = makeMcpToolName(cls.name, fn.name, functionNameUsed);
        const outputSchema = buildToolOutputSchema(fn.returns, typeIndex);
        toolIds.push({
          id,
          fileName,
          className: cls.name,
          methodName: fn.name,
          ...(fn.summary ? { title: fn.summary } : {}),
          description: fn.description ?? `${cls.name}.${fn.name}`,
          inputSchema: buildToolInputSchema(fn.parameters, typeIndex),
          ...(outputSchema ? { outputSchema } : {}),
        });
        if (!functionNameUsed) usedNames.add(fn.name);
      }
    }
  }

  return toolIds;
}
