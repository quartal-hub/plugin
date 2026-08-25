/**
 * Public entry point for `@quartal/plugin-core`.
 *
 * This package has no runtime dependencies and must keep none: it sits at the bottom of the
 * dependency graph for every other `@quartal` package and is consumed from server, browser, and
 * bundler contexts alike. Types and a `fetch`-based client only.
 */

export * from "./client/PluginClient.ts";
export * from "./client/skillCommands.ts";
export * from "./model/index.ts";
