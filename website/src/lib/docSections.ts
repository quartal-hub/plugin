import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";

import { SECTIONS } from "./sections.ts";

export interface DocSection {
  key: string;
  title: string;
  entries: CollectionEntry<"docs">[];
}

/** The doc pages grouped by section in display order — the sidebar, llms.txt etc. all share it. */
export async function docSections(): Promise<DocSection[]> {
  const all = await getCollection("docs");
  return SECTIONS.map((section) => ({
    ...section,
    entries: all
      .filter((e) => e.data.section === section.key)
      .sort((a, b) => a.data.order - b.data.order),
  })).filter((s) => s.entries.length > 0);
}

/** Site origin from `site` in astro.config.mjs, without a trailing slash. */
export const SITE_ORIGIN = import.meta.env.SITE.replace(/\/$/, "");

/** Absolute URL of a doc page. */
export function docUrl(entry: CollectionEntry<"docs">): string {
  return `${SITE_ORIGIN}/docs/${entry.id}/`;
}
