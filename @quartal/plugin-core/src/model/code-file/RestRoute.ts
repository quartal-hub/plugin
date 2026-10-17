/** HTTP methods a tool can be served with on the REST API. */
export type RestMethod = "GET" | "POST" | "PUT" | "DELETE";

/**
 * What a `@rest` JSDoc tag on a tool method declares — the method, the path, or both — before any
 * defaults are applied. The analyzer writes it, {@link RestRoute} is the resolved result.
 */
export interface RestRouteDeclaration {
  /** HTTP method named in the tag (upper-case). */
  method?: RestMethod;
  /**
   * Path named in the tag. With a leading `/` it is relative to the API base path and ignores the
   * class path; otherwise it is appended to the class path.
   */
  path?: string;
}

/** What a `@rest` JSDoc tag on a tool class declares: the class path under the API base path. */
export interface RestClassDeclaration {
  /** Class path without the base path (normalised to a leading `/`). */
  path: string;
}

/** The resolved REST route of one tool method (convention + tags applied). */
export interface RestRoute {
  /** HTTP method. */
  method: RestMethod;
  /** Full path including the API base path, with `{name}` placeholders for path parameters. */
  path: string;
  /** Names of the input properties bound from the path, in path order. */
  pathParams: string[];
  /**
   * Where the input properties outside the path travel: the query string (GET, DELETE), the JSON
   * body (POST, PUT), or nowhere when the method has no input object or the path binds all of it.
   */
  inputIn: "query" | "body" | "none";
}
