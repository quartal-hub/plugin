import type { Company, DescriptionEntry } from "../model/Company.ts";
import type { CompanySummary } from "../model/CompanySummary.ts";

/** Map of supported language codes to PRH's `DescriptionEntry.languageCode` values. */
const LANG_TO_PRH: Record<"fi" | "sv" | "en", string> = {
  fi: "1",
  sv: "2",
  en: "3",
};

/**
 * Picks the current main name (version 1 with type representing the main name) and
 * falls back to whatever the first name is, then the business ID. Always returns a
 * non-empty string when at least the business ID is available.
 * @param company PRH company record.
 */
export function pickMainName(company: Company): string {
  const names = company.names ?? [];
  // Type "1" is the main name (toiminimi). Active = version 1 and no endDate.
  const main = names.find((n) => n.version === 1 && !n.endDate);
  if (main) return main.name;
  if (names.length > 0) return names[0].name;
  return company.businessId?.value ?? "";
}

/**
 * Picks a description in the requested language. Falls back to (in order):
 * Finnish → first available → `undefined`.
 * @param descriptions Description list embedded in the PRH record.
 * @param lang Requested language.
 */
function pickDescription(descriptions: DescriptionEntry[] | undefined, lang: "fi" | "sv" | "en"): string | undefined {
  if (!descriptions || descriptions.length === 0) return undefined;
  const wantedCode = LANG_TO_PRH[lang];
  return (
    descriptions.find((d) => d.languageCode === wantedCode)?.description ??
      descriptions.find((d) => d.languageCode === "1")?.description ??
      descriptions[0]?.description ??
      undefined
  ) ?? undefined;
}

/**
 * Builds a one-line address string from a PRH `Address` block. Prefers the visit
 * address (`type === 1`) and falls back to the first address available. Returns
 * `undefined` if there is nothing to render.
 * @param company PRH company record.
 */
function pickAddress(company: Company): string | undefined {
  const addresses = company.addresses ?? [];
  if (addresses.length === 0) return undefined;
  const visit = addresses.find((a) => a.type === 1) ?? addresses[0];
  const street = visit.street?.trim();
  const postCode = visit.postCode?.trim();
  const city = visit.postOffices?.[0]?.city?.trim();
  const parts = [street, [postCode, city].filter(Boolean).join(" ").trim()].filter(Boolean);
  const line = parts.join(", ").trim();
  return line.length > 0 ? line : undefined;
}

/**
 * Reduces a verbose PRH `Company` to the {@link CompanySummary} fields an agent typically wants.
 * @param company PRH company record.
 * @param lang Language for resolved code descriptions. Defaults to `"fi"`.
 */
export function summarizeCompany(company: Company, lang: "fi" | "sv" | "en" = "fi"): CompanySummary {
  const currentForm = (company.companyForms ?? []).find((f) => f.version === 1) ?? company.companyForms?.[0];
  const formDescription = pickDescription(currentForm?.descriptions, lang);
  const businessLineDescription = pickDescription(company.mainBusinessLine?.descriptions, lang);
  return {
    businessId: company.businessId?.value ?? "",
    name: pickMainName(company),
    companyForm: formDescription ?? currentForm?.type,
    companyFormCode: currentForm?.type,
    registrationDate: company.registrationDate ?? undefined,
    endDate: company.endDate ?? undefined,
    active: !company.endDate,
    address: pickAddress(company),
    website: company.website?.url,
    mainBusinessLine: businessLineDescription,
    mainBusinessLineCode: company.mainBusinessLine?.type,
  };
}
