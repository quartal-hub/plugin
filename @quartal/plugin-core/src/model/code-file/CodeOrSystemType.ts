import type { CodeArrayType } from "./CodeArrayType.ts";
import type { CodeType } from "./CodeType.ts";
import type { SystemType } from "./SystemType.ts";

/** A type that is either a CodeType, a system type, an array type, or a type name (string) for references. */
export type CodeOrSystemType = CodeType | SystemType | CodeArrayType | string;
