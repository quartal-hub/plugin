/**
 * PRH YTJ company record. Mirrors the upstream `/companies` response shape — fields
 * remain optional because PRH omits unknown values rather than nulling them.
 */
export interface Company {
  /** Business ID block (Y-tunnus). */
  businessId?: {
    /**
     * Business ID in canonical `NNNNNNN-C` form.
     * @example "0116297-6"
     */
    value: string;
    /**
     * Date the business ID was issued.
     * @format date
     */
    registrationDate?: string | null;
    /** PRH TLAHDE code for the data source. */
    source: string;
  };
  /** EUID block — pan-European Unique Identifier. */
  euId?: {
    /** EUID code, e.g. `FIFPRO.0116297-6`. */
    value: string;
    /** PRH TLAHDE code for the data source. */
    source: string;
  };
  /** All registered names — main, parallel, auxiliary, previous. Version 1 is current. */
  names?: RegisterName[];
  /** Industry / main business line. */
  mainBusinessLine?: {
    /** Industry code (TOIMI/TOIMI2/TOIMI3 classification). */
    type: string;
    /** Multi-language industry descriptions. */
    descriptions?: DescriptionEntry[];
    /** Which TOIMI classification the code belongs to. */
    typeCodeSet?: string;
    /**
     * When this industry code became effective.
     * @format date
     */
    registrationDate?: string | null;
    /** PRH TLAHDE code for the data source. */
    source: string;
  };
  /** Public website (if registered). */
  website?: {
    /** Full URL of the company website. */
    url: string;
    /**
     * When the website was registered.
     * @format date
     */
    registrationDate?: string | null;
    /** PRH TLAHDE code for the data source. */
    source: string;
  };
  /** Current and (optionally) previous company form (YRMU). */
  companyForms?: CompanyForm[];
  /** Active special situations: liquidation, reorganization, bankruptcy. Empty in the common case. */
  companySituations?: CompanySituation[];
  /** Register entries (which PRH register the company is in, and its status there). */
  registeredEntries?: RegisteredEntry[];
  /** Visit (type=1) and mailing (type=2) addresses. */
  addresses?: Address[];
  /** Trade register status code (REK_KDI). */
  tradeRegisterStatus?: string;
  /** Business ID status code (STATUS3). */
  status?: string;
  /**
   * Original company registration date.
   * @format date
   */
  registrationDate?: string | null;
  /**
   * Liquidation / cease date if the company has ended.
   * @format date
   */
  endDate?: string | null;
  /** Last modification timestamp (`yyyy-MM-dd HH:mm:ss`, no time zone). */
  lastModified?: string;
}

/** One registered name. */
export interface RegisterName {
  /** The actual name text. */
  name: string;
  /** Name type code (TLAJI) — e.g. main name, parallel name, auxiliary name. */
  type: string;
  /**
   * When this name was registered.
   * @format date
   */
  registrationDate?: string | null;
  /**
   * When this name was deregistered.
   * @format date
   */
  endDate?: string | null;
  /** Version number — 1 is the current value, higher numbers are historical. */
  version: number;
  /** PRH TLAHDE code for the data source. */
  source: string;
}

/** One registered company form (YRMU). */
export interface CompanyForm {
  /** YRMU code (e.g. `OY`, `KY`). */
  type: string;
  /** Multi-language descriptions of the code. */
  descriptions?: DescriptionEntry[];
  /**
   * When this form was registered.
   * @format date
   */
  registrationDate?: string | null;
  /**
   * When this form was deregistered.
   * @format date
   */
  endDate?: string | null;
  /** Version number — 1 is current. */
  version: number;
  /** PRH TLAHDE code for the data source. */
  source: string;
}

/** Special situation entry. */
export interface CompanySituation {
  /** Situation code: `SANE`, `SELTILA`, or `KONK`. */
  type: "SANE" | "SELTILA" | "KONK";
  /**
   * When this situation was registered.
   * @format date
   */
  registrationDate?: string | null;
  /**
   * When this situation ended.
   * @format date
   */
  endDate?: string | null;
  /** PRH TLAHDE code for the data source. */
  source: string;
}

/** One register entry — combination of register code and authority. */
export interface RegisteredEntry {
  /** Register entry status code (REK_KDI). */
  type: string;
  /** Multi-language descriptions of the code. */
  descriptions?: DescriptionEntry[];
  /**
   * When this entry was made.
   * @format date
   */
  registrationDate?: string | null;
  /**
   * When this entry ended.
   * @format date
   */
  endDate?: string | null;
  /** Register code (REK). */
  register: string;
  /** Authority code (VIRANOM). */
  authority: string;
}

/** Postal / visit address. */
export interface Address {
  /** Address type — 1 = visit address, 2 = mailing address. */
  type: number;
  /** Street name. */
  street?: string | null;
  /** 5-digit Finnish postal code. */
  postCode?: string | null;
  /** Town / city name in one or more languages. */
  postOffices?: PostOffice[];
  /** PO Box number. */
  postOfficeBox?: string | null;
  /** Building number. */
  buildingNumber?: string | null;
  /** Stairwell letter. */
  entrance?: string | null;
  /** Apartment number. */
  apartmentNumber?: string | null;
  /** Apartment subdivision letter. */
  apartmentIdSuffix?: string | null;
  /** `c/o` field. */
  co?: string | null;
  /** ISO 3166-1 alpha-2 country code. */
  country?: string | null;
  /** Free-form address line for foreign addresses (newlines → spaces, spaces → `_`). */
  freeAddressLine?: string | null;
  /**
   * When this address was registered.
   * @format date
   */
  registrationDate?: string | null;
  /** PRH TLAHDE code for the data source. */
  source: string;
}

/** Town / city block, with language code. */
export interface PostOffice {
  /** Town name. */
  city: string;
  /** Language code (KIELI). */
  languageCode: string;
  /** Statistics Finland 3-digit municipality code. */
  municipalityCode?: string | null;
}

/** Code description in one language. */
export interface DescriptionEntry {
  /** Language code: `1` = fi, `2` = sv, `3` = en. */
  languageCode: string;
  /** Code description text. */
  description?: string | null;
}
