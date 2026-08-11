import type { NoticesCompany } from "./model/NoticesCompany.ts";
import type { NoticesInput } from "./model/NoticesInput.ts";
import type { PublicNotice } from "./model/PublicNotice.ts";
import { getCodeMap, type PrhCodeLang } from "./util/codes.ts";
import { buildPrhUrl, fetchPrhJson, PRH_BASES } from "./util/prhFetch.ts";
import { formatBusinessIdFi } from "./util/validation.ts";

/**
 * Registered notices (KREK / "Kaupparekisterin rekisteröidyt ilmoitukset") for Finnish
 * companies. Wraps https://avoindata.prh.fi/fi/krek/swagger-ui.
 *
 * Only the by-business-id lookup is exposed for tool use — multi-criteria notice
 * search exists in the upstream API but isn't useful for agent workflows. The KREK
 * `/description` endpoint is not exposed either: notice subject codes (e.g. `NIMP`,
 * `TILTAR`) are resolved internally and attached to each notice as `entryDescriptions`.
 */
export class Notices {
  /**
   * Fetches the company record plus all registered notices PRH has on file, and
   * enriches each notice with language-specific descriptions for its `entryCodes`
   * and `typeOfRegistration` code. Notices come back ordered by `registrationDate`
   * descending (most recent first) as PRH returns them.
   *
   * @summary Fetch company + registered notices by business ID (with code descriptions).
   * @param input Business ID and language for code descriptions.
   * @returns Full PRH notices record with `entryDescriptions` populated, or `null` if PRH has no such company.
   */
  static async getCompanyNotices(input: NoticesInput): Promise<NoticesCompany | null> {
    const businessId = formatBusinessIdFi(input.businessId);
    if (!businessId) {
      throw new Error(`Invalid Finnish business ID: ${input.businessId}`);
    }
    const lang: PrhCodeLang = input.lang ?? "fi";
    const url = buildPrhUrl(PRH_BASES.krek, `/${businessId}`, {});
    const company = await fetchPrhJson<NoticesCompany>(url);
    if (!company) return null;
    if (company.publicNotices?.length) {
      const [entryCodes, registrationTypes] = await Promise.all([
        getCodeMap("krek", "EC", lang),
        getCodeMap("krek", "NRT", lang),
      ]);
      company.publicNotices = company.publicNotices.map((n) => enrichNotice(n, entryCodes, registrationTypes));
    }
    return company;
  }
}

/** Adds language-specific descriptions for `entryCodes` and `typeOfRegistration`. */
function enrichNotice(
  notice: PublicNotice,
  entryCodes: Record<string, string>,
  registrationTypes: Record<string, string>,
): PublicNotice {
  const enriched: PublicNotice = { ...notice };
  if (notice.entryCodes?.length) {
    enriched.entryDescriptions = notice.entryCodes.map((code) => entryCodes[code] ?? code);
  }
  if (notice.typeOfRegistration) {
    const desc = registrationTypes[notice.typeOfRegistration];
    if (desc) enriched.typeOfRegistrationDescription = desc;
  }
  return enriched;
}
