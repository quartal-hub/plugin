import type { APIRoute } from "astro";

import { docSections, docUrl, SITE_ORIGIN } from "../lib/docSections.ts";

/**
 * The llms.txt index (https://llmstxt.org): a compact, linkable map of the documentation for
 * coding agents and other LLM tools. `llms-full.txt` carries the full page contents.
 */
export const GET: APIRoute = async () => {
  const sections = await docSections();

  const lines: string[] = [
    "# Quartal Plugins",
    "",
    "> Write plain TypeScript once — get MCP tools, chat widgets (MCP Apps), Agent Skills, agents,",
    "> prompts and a documented OpenAPI/REST service from the same package. Open source (MIT),",
    "> built on Astro; schemas are generated from TypeScript types and JSDoc.",
    "",
    "Create a new plugin non-interactively:",
    "`pnpm create @quartal/plugin my-plugin --yes` (flags: `--description <text>`,",
    "`--auth`/`--no-auth`, `--sample-tool`/`--no-sample-tool`, `--widgets none|vue|react|js`;",
    "with npm, pass flags after `--`: `npm create @quartal/plugin -- my-plugin --yes`).",
    "",
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    for (const entry of section.entries) {
      lines.push(`- [${entry.data.title}](${docUrl(entry)}): ${entry.data.description}`);
    }
    lines.push("");
  }

  lines.push(
    "## Optional",
    "",
    `- [llms-full.txt](${SITE_ORIGIN}/llms-full.txt): every documentation page above in one markdown file`,
    "",
  );

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
