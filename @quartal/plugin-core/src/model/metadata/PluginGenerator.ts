/** The framework a plugin was built with (`@quartal/plugin`) and its version. */
export interface PluginGenerator {
  /** npm package name, `@quartal/plugin`. */
  name: string;
  /** The package version the plugin was built with, e.g. `1.0.0-beta.0`. */
  version: string;
}
