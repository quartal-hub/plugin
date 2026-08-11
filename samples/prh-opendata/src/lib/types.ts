/**
 * Mirrors the plugin's tools/model output shapes for the widgets. Kept in the Vue
 * tree (not imported from /tools) because the Vue bundle is built standalone and
 * Vite cannot reach across the plugin root with `allowImportingTsExtensions` off
 * for outside-of-src paths.
 */

export interface CompanySummary {
  businessId: string;
  name: string;
  companyForm?: string;
  companyFormCode?: string;
  registrationDate?: string;
  endDate?: string;
  active: boolean;
  address?: string;
  website?: string;
  mainBusinessLine?: string;
  mainBusinessLineCode?: string;
}

export interface SearchCompaniesResult {
  mode: "businessId" | "name" | "empty";
  totalResults: number;
  companies: CompanySummary[];
}

export interface RegisterName {
  name: string;
  type: string;
  version: number;
  registrationDate?: string | null;
  endDate?: string | null;
}

export interface Address {
  type: number;
  street?: string | null;
  postCode?: string | null;
  postOffices?: { city: string; languageCode: string }[];
  country?: string | null;
}

export interface Company {
  businessId?: { value: string };
  names?: RegisterName[];
  mainBusinessLine?: { type: string; descriptions?: { languageCode: string; description?: string | null }[] };
  website?: { url: string };
  companyForms?: { type: string; version: number }[];
  registeredEntries?: { type: string; register: string; authority: string }[];
  addresses?: Address[];
  registrationDate?: string | null;
  endDate?: string | null;
}

export interface Financial {
  businessId: string;
  financialDate: string;
  registrationDate?: string;
}

export interface PublicNotice {
  recordNumber: string;
  registrationDate?: string;
  typeOfRegistration?: string;
  typeOfRegistrationDescription?: string;
  entryCodes?: string[];
  entryDescriptions?: string[];
}

export interface SourceStatus {
  ok: boolean;
  notFound?: boolean;
  error?: string;
}

export interface CompanyOverview {
  businessId: string;
  displayName: string | null;
  info: Company | null;
  financials: Financial[];
  notices: PublicNotice[];
  sources: { ytj: SourceStatus; xbrl: SourceStatus; krek: SourceStatus };
}
