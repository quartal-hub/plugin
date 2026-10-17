import type { CodeFunction } from "./CodeFunction.ts";
import type { CodePropOrParam } from "./CodePropOrParam.ts";
import type { RestClassDeclaration } from "./RestRoute.ts";

/** A class parsed from a CodeFile (has methods). Interfaces and classes without methods are CodeType. */
export interface CodeClass {
  /** Name of the class. */
  name: string;

  /** Description of the class. */
  description: string;

  /** Methods of the class. */
  functions: CodeFunction[];

  /** Property of the class: public fields and property getters (setters can be ignored). */
  properties: CodePropOrParam[];

  /** Names of interfaces that the class implements. */
  implements: string[];

  /** Class path on the REST API from the `@rest` JSDoc tag (replaces the kebab-cased class name). */
  rest?: RestClassDeclaration;
}
