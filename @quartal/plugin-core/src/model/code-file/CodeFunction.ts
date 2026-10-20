import type { McpToolAnnotations, McpToolVisibility } from "../mcp/McpTool.ts";
import type { CodePropOrParam } from "./CodePropOrParam.ts";
import type { McpDeclaration } from "./McpDeclaration.ts";
import type { RestRouteDeclaration } from "./RestRoute.ts";

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

  /** Behavior hints from `@readOnly`, `@destructive`, `@idempotent` and `@openWorld` JSDoc (MCP tool `annotations`). */
  annotations?: McpToolAnnotations;

  /** REST method and/or path from the `@rest` JSDoc tag (OpenAPI only; MCP is unaffected). */
  rest?: RestRouteDeclaration;

  /** MCP-side settings from the `@mcp` JSDoc tag (`@mcp hidden` keeps the method off the MCP server). */
  mcp?: McpDeclaration;

  /** Parameters of the function. */
  parameters: CodePropOrParam[];

  /** Return type of the function. */
  returns: CodePropOrParam;

  /** If true, the function is async. */
  isAsync: boolean;

  /** If true, the function is static. */
  isStatic: boolean;
}
