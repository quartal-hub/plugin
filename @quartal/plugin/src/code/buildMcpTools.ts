import type { CodeFile, McpToolDescriptor } from "@quartal/plugin-core";
import { buildTypeIndex } from "./buildTypeIndex.ts";
import { classNoun, CRUD_VERBS, resolveToolAnnotations, splitLeadingVerb } from "./crudVerbs.ts";
import { buildToolInputSchema, buildToolOutputSchema } from "./jsonSchemaFromCode.ts";

/** Sanitized MCP name (`^[a-zA-Z0-9_-]{1,128}$`).
 * @param className Source class name.
 * @param methodName Source method name.
 * @param methodNameUsed Whether the method name alone is already taken within the plugin.
 */
export function makeMcpToolName(
  className: string,
  methodName: string,
  methodNameUsed: boolean,
): string {
  return sanitizeMcpName(methodNameUsed ? `${className}_${methodName}` : methodName);
}

function sanitizeMcpName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned.length > 128 ? cleaned.slice(0, 128) : cleaned;
}

/**
 * The MCP tool name a method gets before duplicates are resolved: the method name, completed with
 * the class noun when the name is a bare CRUD verb (`Invoices.get` → `getInvoice`, `Invoices.list`
 * → `listInvoices`), the way the method would be named outside a resource class.
 * @param className Source class name.
 * @param methodName Source method name.
 */
export function baseMcpToolName(className: string, methodName: string): string {
  const verb = splitLeadingVerb(methodName);
  if (!verb || verb.rest !== "") return methodName;
  return `${verb.verb}${classNoun(className, CRUD_VERBS[verb.verb].collection ?? false)}`;
}

/** Builds the MCP tool list from code files (same shape as `mcp-tools.json`); methods and classes
 * marked `@mcp hidden` are left out. A name two classes share becomes `Class_name` on both.
 * @param codeFiles Analyzed code files containing MCP tool classes.
 */
export function buildMcpTools(codeFiles: CodeFile[]): McpToolDescriptor[] {
  const typeIndex = buildTypeIndex(codeFiles);
  const toolIds: McpToolDescriptor[] = [];

  const methods = codeFiles
    .filter((file) => file.path !== "__system__.ts")
    .flatMap((file) => {
      const fileName = file.path.replace(/\.ts$/, "").replace(/^.*[/\\]/, "");
      return file.classes
        .filter((cls) => !cls.mcp?.hidden)
        .flatMap((cls) => cls.functions
          .filter((fn) => !fn.mcp?.hidden)
          .map((fn) => ({ fileName, cls, fn, base: baseMcpToolName(cls.name, fn.name) })));
    });
  const baseCounts = new Map<string, number>();
  for (const m of methods) baseCounts.set(m.base, (baseCounts.get(m.base) ?? 0) + 1);

  for (const { fileName, cls, fn, base } of methods) {
    const id = sanitizeMcpName((baseCounts.get(base) ?? 0) > 1 ? `${cls.name}_${base}` : base);
    const outputSchema = buildToolOutputSchema(fn.returns, typeIndex);
    const annotations = resolveToolAnnotations(fn.name, fn.annotations);
    toolIds.push({
      id,
      fileName,
      className: cls.name,
      methodName: fn.name,
      ...(fn.summary ? { title: fn.summary } : {}),
      description: fn.description ?? `${cls.name}.${fn.name}`,
      inputSchema: buildToolInputSchema(fn.parameters, typeIndex),
      ...(outputSchema ? { outputSchema } : {}),
      ...(fn.visibility ? { visibility: fn.visibility } : {}),
      ...(annotations ? { annotations } : {}),
    });
  }

  return toolIds;
}
