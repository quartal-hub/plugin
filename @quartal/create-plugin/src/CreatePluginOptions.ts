/** Widget flavor scaffolded into the new plugin. */
export type WidgetFramework = "none" | "vue" | "react" | "js";

/** Everything the starter kit asks (or reads from argv) before scaffolding a plugin project. */
export interface CreatePluginOptions {
  /** npm package name of the new plugin (optionally scoped). Also the target directory (without scope). */
  name: string;
  /** One-line description used in `package.json` and `qrtl.config.ts`. May be empty. */
  description: string;
  /** `true` scaffolds Quartal Hub authentication (OAuth2, `auth: "quartal-iam"`); `false` scaffolds `auth: "anon"`. */
  auth: boolean;
  /** Whether to scaffold the sample tool class (`src/tools/HelloWorld.ts`). */
  sampleTool: boolean;
  /** Widget framework to scaffold under `src/pages/widgets/`, or `"none"`. */
  widgets: WidgetFramework;
}
