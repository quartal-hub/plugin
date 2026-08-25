import { getCached } from "@quartal/plugin";

import { buildPrhUrl, fetchPrhText, PRH_BASES } from "./prhFetch.ts";

/**
 * Three months in milliseconds. PRH code lists (company forms, name types, entry
 * codes, post code directory) effectively never change — once cached, a fresh value
 * is fine for months. KV reads stay cheap so we re-validate after the TTL anyway.
 */
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

/** Which PRH code service to query. */
export type PrhCodeService = "ytj" | "krek";

/** Supported language codes for code list descriptions. */
export type PrhCodeLang = "fi" | "sv" | "en";

/**
 * Returns a `code → description` map for one PRH code set in one language. Cached
 * for 90 days in the plugin cache; first miss takes ~1 PRH call, every subsequent call
 * across the whole process (and process restarts) is a memory + cache hit.
 *
 * Used internally by the tool classes to enrich opaque codes (e.g. KREK
 * `entryCodes` = `["NIMP", "TILTAR"]` → "Toiminimen muutos" / "Tilinpäätös, tarkennus")
 * so the agent and the user see human-readable text without paying for a per-call lookup.
 *
 * @param service `"ytj"` for YTJ-side code sets (YRMU, REK_KDI, TLAJI, …) or
 *                `"krek"` for KREK-side sets (`CF`, `EC`, `NRT`). YTJ expects lower-case
 *                language codes; KREK expects upper-case. This helper handles both.
 * @param code The code-set name to fetch (e.g. `"YRMU"`, `"EC"`).
 * @param lang Language for the description text.
 * @returns A plain object mapping codes to their language-specific descriptions. Empty
 *          object if PRH returned 404 or the response could not be parsed.
 */
export function getCodeMap(
  service: PrhCodeService,
  code: string,
  lang: PrhCodeLang,
): Promise<Record<string, string>> {
  return getCached<Record<string, string>>(
    ["prh", service, "code-map", code, lang],
    async () => {
      const base = service === "ytj" ? PRH_BASES.ytj : PRH_BASES.krek;
      // YTJ uses fi/sv/en; KREK insists on FI/SV/EN.
      const langParam = service === "ytj" ? lang : lang.toUpperCase();
      const url = buildPrhUrl(base, "/description", { code, lang: langParam });
      const text = (await fetchPrhText(url)) ?? "";
      return parseCodeList(text);
    },
    { ttlMs: THREE_MONTHS_MS, staleOnError: true },
  );
}

/**
 * Parses PRH's `/description` plain-text response into a `{ code: description }` map.
 *
 * PRH returns one record per line, split by tab or semicolon. We try both, take the
 * first field as the code and everything after it joined by space as the description.
 * Blank lines and lines without a separator are skipped.
 * @param text Raw response text.
 */
function parseCodeList(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : null;
    if (!sep) continue;
    const parts = line.split(sep).map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length < 2) continue;
    const code = parts[0];
    const description = parts.slice(1).join(" ");
    if (code && description) out[code] = description;
  }
  return out;
}
