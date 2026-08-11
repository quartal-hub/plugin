import type { CodeOrSystemType } from "./CodeOrSystemType.ts";

/** An array type. */
export interface CodeArrayType {
  /** Type of the array. */
  items: CodeOrSystemType;
}
