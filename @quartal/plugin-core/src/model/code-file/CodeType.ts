import type { CodePropOrParam } from "./CodePropOrParam.ts";

/** A type or interface that is used in a CodeFile */
export interface CodeType {
  /** Name of the type. */
  name: string;

  /** Description of the type. */
  description: string;

  /** Properties of the class: public fields and property getters (setters can be ignored). */
  properties: CodePropOrParam[];

  /**
   * Type names that the type extends (or implements).
   * Use type name strings; for local types the renderer can link to the definition.
   */
  extends: string[];

  /** Members when the type is a string literal union (e.g. `"fi" | "sv" | "en"`). */
  enum?: string[];
}
