import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Doc pages are plain markdown under src/content/docs; `section` groups them in the
// sidebar (see src/lib/sections.ts for titles and ordering) and `order` sorts within a section.
const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    section: z.enum(["start", "tools", "widgets", "skills", "more", "framework"]),
    order: z.number().default(0),
  }),
});

export const collections = { docs };
