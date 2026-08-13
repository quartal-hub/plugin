import type { CodeFile, McpPromptDescriptor, PromptArgument } from "@quartal/plugin-core";
import { buildTypeIndex } from "./buildTypeIndex.ts";
import { buildToolInputSchema } from "./jsonSchemaFromCode.ts";
import { makeMcpToolName } from "./buildMcpTools.ts";

/**
 * Builds the MCP prompt list from analyzed prompt code files (same shape as `mcp-prompts.json`).
 * Each prompt-class function becomes one prompt; the properties of its single object parameter
 * become the prompt arguments. MCP prompt arguments are string-valued on the wire, so only the
 * property names, descriptions and required-ness are kept from the input schema.
 * @param promptFiles Analyzed code files from the plugin's `prompts/` entry.
 */
export function buildMcpPrompts(promptFiles: CodeFile[]): McpPromptDescriptor[] {
  const typeIndex = buildTypeIndex(promptFiles);
  const prompts: McpPromptDescriptor[] = [];
  const usedNames = new Set<string>();

  for (const file of promptFiles) {
    if (file.path === "__system__.ts") continue;
    const fileName = file.path.replace(/\.ts$/, "").replace(/^.*[/\\]/, "");
    for (const cls of file.classes) {
      for (const fn of cls.functions) {
        const functionNameUsed = usedNames.has(fn.name);
        const id = makeMcpToolName(cls.name, fn.name, functionNameUsed);
        prompts.push({
          id,
          fileName,
          className: cls.name,
          methodName: fn.name,
          ...(fn.summary ? { title: fn.summary } : {}),
          description: fn.description ?? `${cls.name}.${fn.name}`,
          arguments: buildPromptArguments(fn.parameters, typeIndex),
        });
        if (!functionNameUsed) usedNames.add(fn.name);
      }
    }
  }

  return prompts;
}

/** Flattens the prompt function's input-object schema into MCP prompt arguments. */
function buildPromptArguments(
  parameters: Parameters<typeof buildToolInputSchema>[0],
  typeIndex: Parameters<typeof buildToolInputSchema>[1],
): PromptArgument[] {
  const schema = buildToolInputSchema(parameters, typeIndex) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, prop]) => {
    const meta = (prop && typeof prop === "object" ? prop : {}) as { title?: unknown; description?: unknown };
    return {
      name,
      ...(typeof meta.title === "string" && meta.title ? { title: meta.title } : {}),
      ...(typeof meta.description === "string" && meta.description ? { description: meta.description } : {}),
      ...(required.has(name) ? { required: true } : {}),
    };
  });
}
