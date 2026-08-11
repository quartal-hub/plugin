import type { CodeOrSystemType } from "./CodeOrSystemType.ts";

/** A property or parameter of a function or class. */
export interface CodePropOrParam {
  /** Name of the property or parameter. */
  name: string;
  /** Type of the property or parameter. */
  type: CodeOrSystemType;
  /** Description of the property or parameter. */
  description: string;
  /** If true, the property / parameter is optional (e.g. `foo?: string`). */
  optional?: boolean;
  /** If true, the property / parameter may be null (e.g. `foo: string | null`). */
  nullable?: boolean;
  /** JSON Schema / OpenAPI format tag extracted from JSDoc (e.g. `@format uuid`). */
  format?: string;
  /** Example value from JSDoc `@example` (first value when several are listed). */
  example?: unknown;
}
