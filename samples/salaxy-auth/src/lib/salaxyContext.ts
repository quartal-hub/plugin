import { AjaxFetch } from "@salaxy/core";
import type { QuartalPluginContext } from "@quartal/plugin-core";
import type { SalaxyCompany } from "../tools/model/index.ts";

/**
 * The Quartal IAM API: lists the companies the signed-in user may act for (`/api/Companies/mine`),
 * issues a Salaxy token for one of them (`/api/SalaxySso/createToken`) and stores the user's choice
 * (`/api/Secrets/*`). Overridable via the `QUARTAL_IAM_API_URL` environment variable.
 */
const IAM_API_URL = process.env.QUARTAL_IAM_API_URL || "https://iam-api.quartal.deno.net";

/**
 * The Salaxy API root the issued tokens are used against. The token itself does not carry it; it is the
 * API counterpart of the Salaxy server the IAM is configured with. Overridable via `SALAXY_API_URL`.
 */
const SALAXY_API_URL = process.env.SALAXY_API_URL || "https://test-api.salaxy.com";

/** Name of the per-user IAM secret that remembers the selected company across requests and server instances. */
const SELECTION_SECRET = "plugin.salaxy-auth.company";

/** Result of the IAM API `/api/SalaxySso/createToken`. */
export interface SalaxyToken {
  /** The Salaxy bearer token (about 48 h; no refresh token — create a new one). */
  accessToken: string;
  /** The Salaxy account the token acts as (IBAN format). */
  accountId: string;
  /** The `credential_id` claim: the signed-in user's id in the IAM. */
  credentialId: string;
  /** When the token expires, ISO 8601. */
  expiresAt: string;
}

/**
 * The Salaxy session/API context the tools need — an authenticated Salaxy `AjaxFetch` client
 * for the selected company.
 */
export interface SalaxyContext {
  /** Returns an authenticated Salaxy ajax client acting as the selected company. */
  getAjax(): AjaxFetch;
  /** The company the client acts as. */
  company: SalaxyCompany;
  /** The Salaxy token the client was built from. */
  token: SalaxyToken;
}

/** Thrown when the operation needs a selected company and none is. Its message is written for the AI agent. */
export class CompanyNotSelectedError extends Error {}

function requireToken(ctx: QuartalPluginContext): string {
  if (!ctx.token) {
    throw new Error("Salaxy tools require an authenticated Quartal session (no access token in context).");
  }
  return ctx.token;
}

async function callIam<T>(quartalToken: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${IAM_API_URL}${path}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${quartalToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const hint = res.status === 401
      ? ` The Quartal token was not accepted by the IAM API — it must carry the "iam-api" scope/audience `
        + `(the IAM realm must allow the plugin's client to request that scope).`
      : "";
    throw new Error(`Quartal IAM API ${path} failed (${res.status} ${res.statusText}).${hint} ${text}`.trim());
  }
  return await res.json() as T;
}

/** The part of the IAM `Companies/mine` row this sample reads. */
interface IamCompany {
  companyId: string;
  name: string;
  businessId: string | null;
  role: string;
  via: "direct" | "team";
  firmName: string | null;
  salaxyAccountId: string | null;
  avatar: { color: string | null; initials: string | null; url: string | null };
}

/**
 * The companies the signed-in user may act for in Salaxy: direct memberships and customers reached through an
 * advisor's team. Companies without a Salaxy account cannot be acted on and are left out.
 * @param ctx The verified Quartal IAM context for the current request.
 */
export async function listCompanies(ctx: QuartalPluginContext): Promise<SalaxyCompany[]> {
  const { companies } = await callIam<{ companies: IamCompany[] }>(requireToken(ctx), "/api/Companies/mine", {});
  return companies
    .filter((c) => c.salaxyAccountId)
    .map((c) => ({
      companyId: c.companyId,
      name: c.name,
      businessId: c.businessId ?? undefined,
      salaxyAccountId: c.salaxyAccountId!,
      role: c.role,
      via: c.via,
      firmName: c.firmName ?? undefined,
      avatar: {
        color: c.avatar.color ?? undefined,
        initials: c.avatar.initials ?? undefined,
        url: c.avatar.url ?? undefined,
      },
    }));
}

async function storedSelection(quartalToken: string): Promise<string | null> {
  const { secret } = await callIam<{ secret: { value: string } | null }>(quartalToken, "/api/Secrets/get", {
    name: SELECTION_SECRET,
  });
  return secret?.value ?? null;
}

/**
 * The companies the user may act for and the one their operations run in: the one they selected, or the only
 * one they have. A stored choice that is no longer among the user's companies is ignored.
 * @param ctx The verified Quartal IAM context for the current request.
 */
export async function getSelection(ctx: QuartalPluginContext): Promise<{ companies: SalaxyCompany[]; selected?: SalaxyCompany }> {
  const [companies, stored] = await Promise.all([listCompanies(ctx), storedSelection(requireToken(ctx))]);
  const selected = companies.find((c) => c.companyId === stored) ?? (companies.length === 1 ? companies[0] : undefined);
  return { companies, selected };
}

/**
 * The company the user's operations run in.
 * @param ctx The verified Quartal IAM context for the current request.
 * @throws {CompanyNotSelectedError} When the user has no company, or several and has not chosen one.
 */
export async function getSelectedCompany(ctx: QuartalPluginContext): Promise<SalaxyCompany> {
  const { companies, selected } = await getSelection(ctx);
  if (selected) return selected;
  throw new CompanyNotSelectedError(
    companies.length === 0
      ? "The signed-in user has no company with a Salaxy account to act for."
      : "No company is selected. Call getCompanies, let the user choose the company to work in "
        + "(or call selectCompany with its companyId), then retry.",
  );
}

/**
 * Remembers the company the user's operations run in from now on.
 * @param ctx The verified Quartal IAM context for the current request.
 * @param companyId Directory id of one of the user's companies.
 * @returns The selected company.
 */
export async function selectCompany(ctx: QuartalPluginContext, companyId: string): Promise<SalaxyCompany> {
  const company = (await listCompanies(ctx)).find((c) => c.companyId === companyId);
  if (!company) throw new Error(`Company ${companyId} is not one of the signed-in user's companies.`);
  await callIam(requireToken(ctx), "/api/Secrets/set", {
    name: SELECTION_SECRET,
    kind: "preference",
    value: company.companyId,
    metadata: { companyName: company.name },
  });
  return company;
}

// A Salaxy token lives ~48 h but the cache key includes the caller's Quartal access token (~1 h),
// so entries die with the Quartal session; the extra cap below keeps the map from growing stale.
const TOKEN_CACHE_MAX_TTL_MS = 30 * 60 * 1000;
const tokenCache = new Map<string, { token: SalaxyToken; validUntil: number }>();

async function getSalaxyToken(quartalToken: string, companyId: string): Promise<SalaxyToken> {
  const key = `${companyId}\n${quartalToken}`;
  const cached = tokenCache.get(key);
  if (cached && cached.validUntil > Date.now()) return cached.token;
  tokenCache.delete(key);

  const token = await callIam<SalaxyToken>(quartalToken, "/api/SalaxySso/createToken", { companyId });
  const expiresAtMs = Date.parse(token.expiresAt);
  const validUntil = Math.min(Date.now() + TOKEN_CACHE_MAX_TTL_MS, Number.isNaN(expiresAtMs) ? Infinity : expiresAtMs);
  if (validUntil > Date.now()) tokenCache.set(key, { token, validUntil });
  return token;
}

/**
 * Maps the Quartal IAM context ({@link QuartalPluginContext}) to a {@link SalaxyContext} for the user's
 * selected company: asks the Quartal IAM API for a Salaxy token for it and builds an authenticated
 * `AjaxFetch` against the Salaxy API.
 * @param ctx The verified Quartal IAM context for the current request.
 * @throws {CompanyNotSelectedError} When no company is selected yet.
 */
export async function quartalContextToSalaxyContext(ctx: QuartalPluginContext): Promise<SalaxyContext> {
  const company = await getSelectedCompany(ctx);
  const token = await getSalaxyToken(requireToken(ctx), company.companyId);
  return {
    company,
    token,
    getAjax: () => new AjaxFetch(token.accessToken, SALAXY_API_URL),
  };
}
