import type { McpToolVisibility } from "../mcp/McpTool.ts";
import type { CodePropOrParam } from "./CodePropOrParam.ts";

/** A function parsed from a CodeFile */
export interface CodeFunction {
  /** Name of the function. */
  name: string;

  /** Description of the function. */
  description: string;

  /** Short summary from `@summary` JSDoc (OpenAPI `summary` / MCP `title`). */
  summary?: string;

  /** Visibility scopes from `@visibility` JSDoc (MCP Apps `_meta.ui.visibility`). */
  visibility?: McpToolVisibility[];

  /** Parameters of the function. */
  parameters: CodePropOrParam[];

  /** Return type of the function. */
  returns: CodePropOrParam;

  /** If true, the function is async. */
  isAsync: boolean;

  /** If true, the function is static. */
  isStatic: boolean;
}
