import { computed, ref } from "vue";
import { pluginClient } from "./pluginClient.ts";

/**
 * Login state for the docs site. The server's `/oauth/login` + `/oauth/callback` routes run the
 * OAuth authorization-code + PKCE flow (the same CIMD method MCP clients use) and hand the access
 * token back in the URL fragment, which this module captures on load. The token lives in
 * `sessionStorage` and is injected into Swagger UI requests.
 */

const STORAGE_KEY = "qrtl_docs_token";

interface StoredToken {
  accessToken: string;
  /** Epoch milliseconds; 0 when the token carried no expiry. */
  expiresAt: number;
}

const token = ref<string | null>(null);
const authError = ref<string | null>(null);
/** Whether the plugin is authenticated at all (serves OAuth protected-resource metadata). */
const authAvailable = ref(false);

function readStored(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredToken;
    if (stored.expiresAt && stored.expiresAt < Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored.accessToken;
  } catch {
    return null;
  }
}

function store(accessToken: string, expiresIn?: number): void {
  const stored: StoredToken = {
    accessToken,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : 0,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Session storage unavailable (private mode etc.) — the in-memory ref still works.
  }
}

/** Captures `#access_token=…` / `#auth_error=…` left by `/oauth/callback` and cleans the URL. */
function captureFragment(): void {
  let fragment = window.location.hash.replace(/^#/, "");
  if (!fragment.includes("access_token=") && !fragment.includes("auth_error=")) {
    // The hash router may have normalized the URL already — the page's initial URL still has it.
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    fragment = nav?.name?.split("#")[1] ?? "";
  }
  if (!fragment) return;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token");
  const error = params.get("auth_error");
  if (!accessToken && !error) return;
  if (accessToken) {
    const expiresIn = Number(params.get("expires_in")) || undefined;
    store(accessToken, expiresIn);
    token.value = accessToken;
  }
  if (error) authError.value = error;
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

captureFragment();
token.value ??= readStored();

/** Decoded JWT payload of the current token, or undefined. */
function tokenClaims(): Record<string, unknown> | undefined {
  if (!token.value) return undefined;
  try {
    const payload = token.value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

const userName = computed(() => {
  // Recompute when the token changes.
  void token.value;
  const claims = tokenClaims();
  if (!claims) return undefined;
  return (claims.name || claims.preferred_username || claims.email || claims.sub) as string | undefined;
});

/** Login state and actions for the docs site. */
export function useDocsAuth() {
  return {
    /** Current bearer token, or null when not logged in. */
    token,
    /** Error message from a failed login, or null. */
    authError,
    /** Whether the plugin has authentication at all (shows/hides the login UI). */
    authAvailable,
    /** Display name from the token claims. */
    userName,
    /** Starts the server-driven OAuth login flow (full-page redirect). */
    login(): void {
      window.location.href = pluginClient.url("/oauth/login");
    },
    /** Forgets the token. (The IAM session may still exist; this only logs the docs site out.) */
    logout(): void {
      token.value = null;
      authError.value = null;
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
    /** Probes the plugin for OAuth support; call once on app mount. */
    async checkAvailable(): Promise<void> {
      try {
        const res = await fetch(pluginClient.url("/.well-known/oauth-protected-resource"));
        authAvailable.value = res.ok;
      } catch {
        authAvailable.value = false;
      }
    },
  };
}
