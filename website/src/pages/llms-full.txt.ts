import type { APIRoute } from "astro";

import { docSections, docUrl, SITE_ORIGIN } from "../lib/docSections.ts";

/** Rewrites root-relative markdown links (`](/docs/...)`) to absolute URLs. */
function absolutizeLinks(markdown: string): string {
  return markdown.replaceAll("](/", `](${SITE_ORIGIN}/`);
}

/** The full documentation as one markdown file, for LLM tools that prefer a single fetch. */
export const GET: APIRoute = async () => {
  const sections = await docSections();

  const parts: string[] = [
    "# Quartal Plugins — full documentation",
    "",
    `The complete documentation of https://plugin.quartal.com in one file; the index is at ${SITE_ORIGIN}/llms.txt.`,
    "",
  ];

  for (const section of sections) {
    for (const entry of section.entries) {
      parts.push(
        "---",
        "",
        `# ${entry.data.title}`,
        "",
        `> ${entry.data.description}`,
        "",
        `Canonical URL: ${docUrl(entry)}`,
        "",
        absolutizeLinks(entry.body ?? "").trim(),
        "",
      );
    }
  }

  return new Response(parts.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
