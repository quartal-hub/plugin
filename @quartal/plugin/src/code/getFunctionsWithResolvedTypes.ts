import type { CodeFile, CodeFunction, CodeOrSystemType, CodePropOrParam, CodeType } from "../model/index.ts";
import { buildTypeIndex } from "./buildTypeIndex.ts";

/**
 * Function metadata with parameter and return types resolved from the global type index.
 */
export interface FunctionWithResolvedTypes {
  /**
   * Absolute file path of the source file that declares the function.
   */
  filePath: string;
  /**
   * Name of the class that owns the function.
   */
  className: string;
  /**
   * Original function node including its name, parameters and return type refs.
   */
  fn: CodeFunction;
  /**
   * Parameters where `type` has been resolved from any string `typeRef` into a concrete `CodeType`
   * when present in the index.
   */
  parameters: CodePropOrParam[];
  /**
   * Return value description where `type` has been resolved from any string `typeRef`
   * into a concrete `CodeType` when present in the index.
   */
  returns: CodePropOrParam;
}

/** Re-export for callers that imported from here. */
export { buildTypeIndex } from "./buildTypeIndex.ts";

/**
 * Resolve a top-level type ref (string or array of string) to CodeType when present in index.
 * Does not deep-resolve (properties[].type stay as refs), so no circular reference in memory.
 */
function resolveTopLevelType(
  type: CodeOrSystemType,
  index: Map<string, CodeType>,
): CodeOrSystemType {
  if (typeof type === "string") {
    const resolved = index.get(type.trim());
    return resolved ?? type;
  }
  if (typeof type === "object" && type !== null && "items" in type) {
    return {
      items: resolveTopLevelType((type as { items: CodeOrSystemType }).items, index),
    };
  }
  return type;
}

/**
 * Returns all functions from codeFiles with parameter and return types resolved from the type index.
 * Use this when you need full type objects (e.g. for docs or tooling). The ref-only form in codeFiles
 * is JSON-serializable; this resolved form may contain cycles if you deep-resolve (we only resolve top-level).
 * @param codeFiles Analyzed code files whose functions are resolved.
 */
export function getFunctionsWithResolvedTypes(
  codeFiles: CodeFile[],
): FunctionWithResolvedTypes[] {
  const index = buildTypeIndex(codeFiles);
  const result: FunctionWithResolvedTypes[] = [];

  for (const file of codeFiles) {
    for (const cls of file.classes) {
      for (const fn of cls.functions) {
        result.push({
          filePath: file.path,
          className: cls.name,
          fn,
          parameters: fn.parameters.map((p) => ({
            ...p,
            type: resolveTopLevelType(p.type, index),
          })),
          returns: {
            ...fn.returns,
            type: resolveTopLevelType(fn.returns.type, index),
          },
        });
      }
    }
  }
  return result;
}
