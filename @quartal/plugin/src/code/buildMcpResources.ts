import type { CodeFile, McpResourceDescriptor } from "@quartal/plugin-core";
import { makeMcpToolName } from "./buildMcpTools.ts";

/** Matches the `{variable}` (and `{+variable}`, `{/variable}` …) expressions of an RFC 6570 template. */
const TEMPLATE_EXPRESSION = /\{[+#./;?&]?([A-Za-z0-9_]+)\*?\}/g;

/**
 * The variable names of a URI template (`policy://expenses/{category}` → `["category"]`).
 * @param uri A resource URI or URI template.
 */
export function uriTemplateVariables(uri: string): string[] {
  return [...uri.matchAll(TEMPLATE_EXPRESSION)].map((m) => m[1]);
}

/**
 * Builds the MCP resource list from analyzed resource code files (same shape as
 * `mcp-resources.json`). Every method of a class exported from `src/resources/mod.ts` is a
 * resource and must carry a `@uri` tag; a URI with `{variables}` makes it a resource template whose
 * variables are the properties of the method's input object.
 * @param resourceFiles Analyzed code files from the plugin's `resources/` entry.
 * @throws When a method has no `@uri`, two resources share a URI, or a template variable is not a
 * property of the method's input.
 */
export function buildMcpResources(resourceFiles: CodeFile[]): McpResourceDescriptor[] {
  const resources: McpResourceDescriptor[] = [];
  const usedNames = new Set<string>();
  const usedUris = new Set<string>();

  for (const file of resourceFiles) {
    if (file.path === "__system__.ts") continue;
    const fileName = file.path.replace(/\.ts$/, "").replace(/^.*[/\\]/, "");
    for (const cls of file.classes) {
      for (const fn of cls.functions) {
        const where = `${cls.name}.${fn.name}`;
        const declaration = fn.resource;
        if (!declaration) {
          throw new Error(`${where}: a resource method needs a @uri tag (e.g. "@uri policy://travel").`);
        }
        if (usedUris.has(declaration.uri)) throw new Error(`${where}: @uri ${declaration.uri} is used twice.`);
        usedUris.add(declaration.uri);

        const variables = uriTemplateVariables(declaration.uri);
        const inputProps = new Set(inputPropertyNames(resourceFiles, fn.parameters[0]?.type));
        const missing = variables.filter((v) => !inputProps.has(v));
        if (missing.length) {
          throw new Error(`${where}: the @uri variables ${missing.map((v) => `{${v}}`).join(", ")} are not properties of the method's input.`);
        }

        const nameUsed = usedNames.has(fn.name);
        resources.push({
          id: makeMcpToolName(cls.name, fn.name, nameUsed),
          fileName,
          className: cls.name,
          methodName: fn.name,
          uri: declaration.uri,
          template: variables.length > 0,
          ...(fn.summary ? { title: fn.summary } : {}),
          description: fn.description || `${cls.name}.${fn.name}`,
          ...(declaration.mimeType ? { mimeType: declaration.mimeType } : {}),
          ...(declaration.cacheTtlMs !== undefined ? { cacheTtlMs: declaration.cacheTtlMs } : {}),
          ...(declaration.cacheScope ? { cacheScope: declaration.cacheScope } : {}),
        });
        usedNames.add(fn.name);
      }
    }
  }
  return resources;
}

/** Property names of a method's input type (a named type in the files, or an inline object). */
function inputPropertyNames(files: CodeFile[], type: unknown): string[] {
  if (!type) return [];
  if (typeof type === "object" && type !== null && "properties" in type) {
    return (type as { properties: { name: string }[] }).properties.map((p) => p.name);
  }
  if (typeof type === "string") {
    for (const file of files) {
      const named = file.types.find((t) => t.name === type);
      if (named) return named.properties.map((p) => p.name);
    }
  }
  return [];
}
