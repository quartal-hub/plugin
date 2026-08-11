/**
 * Validation helpers for Finnish identifiers used by PRH Open Data.
 *
 * The PRH API expects the canonical 9-character business ID format with a dash before
 * the checksum (`NNNNNNN-C`, e.g. `0116297-6`). Agents and end users frequently paste
 * variants ("FI01162976", " 0116297-6 ", "1162976") — these helpers normalize and validate
 * those before we hit the upstream service.
 *
 * The checksum algorithm and quirks (FI prefix, 7→8 digit padding, n-dash/m-dash) are
 * ported from `@salaxy/core` `Validation.formatCompanyIdFi`. We do not depend on
 * `@salaxy/core` here because the PRH plugin should be standalone.
 */

const MULTIPLIERS = [7, 9, 10, 5, 8, 4, 2] as const;

/**
 * Strips dashes (incl. n-dash and m-dash), `FI` prefix, whitespace, and pads a 7-digit
 * legacy business ID to 8 digits.
 * @param candidate Raw user input.
 * @returns Cleaned 8-digit string, or `null` if it can't be coerced to 8 digits.
 */
function normalize(candidate: string): string | null {
  if (!candidate) return null;
  let cleaned = candidate.toUpperCase().trim().replace(/-|–|—/g, "");
  if (cleaned.startsWith("FI")) cleaned = cleaned.slice(2);
  if (cleaned.length === 7) cleaned = "0" + cleaned; // legacy 6+1 format
  if (cleaned.length !== 8) return null;
  if (!/^\d{7}[\d*]$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Returns true if the input is a syntactically and checksum-valid Finnish business ID
 * (Y-tunnus). Accepts `0116297-6`, `01162976`, `FI01162976`, and 7-digit legacy form.
 *
 * Asterisk (`*`) checksums are allowed for compatibility with placeholder IDs used in
 * the YTJ database; PRH actually returns numeric checksums.
 * @param candidate Raw user input.
 */
export function isBusinessIdFi(candidate: string): boolean {
  const cleaned = normalize(candidate);
  if (!cleaned) return false;
  let total = 0;
  for (let i = 0; i < 7; i++) {
    total += Number(cleaned.charAt(i)) * MULTIPLIERS[i];
  }
  const modulo = total % 11;
  if (modulo === 1) return false;
  const checksum = modulo === 0 ? 0 : 11 - modulo;
  return cleaned.charAt(7) === "*" || Number(cleaned.charAt(7)) === checksum;
}

/**
 * Normalizes a business ID into the canonical `NNNNNNN-C` form that PRH expects, or
 * returns `null` if the input is not a valid business ID. Use this just before calling
 * upstream so the URL parameter is always in the PRH-accepted shape.
 * @param candidate Raw user input.
 */
export function formatBusinessIdFi(candidate: string): string | null {
  const cleaned = normalize(candidate);
  if (!cleaned || !isBusinessIdFi(candidate)) return null;
  return `${cleaned.slice(0, 7)}-${cleaned.slice(7)}`;
}
