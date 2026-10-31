/**
 * `@quartal/plugin-embed/guide` — copy-paste material for embedding a plugin's widgets: snippets,
 * a coding-agent prompt and the `embed.md` Markdown, generated from a tool's input schema.
 * @module
 */
export { buildEmbedGuide, buildEmbedIndex, type EmbedGuide, type EmbedGuideInput, type EmbedGuideTool } from "./buildEmbedGuide.ts";
export { exampleFromSchema } from "./exampleFromSchema.ts";
export { type JsonSchema, schemaToTypeScript } from "./schemaToTypeScript.ts";
