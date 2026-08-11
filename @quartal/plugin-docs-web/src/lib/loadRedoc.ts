import redocStandaloneUrl from "redoc/bundles/redoc.standalone.js?url";

export interface RedocStandalone {
  init: (specUrl: string, options: Record<string, unknown>, element: HTMLElement) => void;
}

declare global {
  interface Window {
    Redoc?: RedocStandalone;
  }
}

const REDOC_SCRIPT_ID = "redoc-standalone-script";

/** Loads ReDoc standalone script without bundling it through Vite. */
export function loadRedoc(): Promise<RedocStandalone> {
  if (window.Redoc) return Promise.resolve(window.Redoc);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(REDOC_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.Redoc) resolve(window.Redoc);
        else reject(new Error("ReDoc global missing after script load"));
      }, { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load ReDoc script")), { once: true });
      if (window.Redoc) resolve(window.Redoc);
      return;
    }

    const script = document.createElement("script");
    script.id = REDOC_SCRIPT_ID;
    script.src = redocStandaloneUrl;
    script.onload = () => {
      if (window.Redoc) resolve(window.Redoc);
      else reject(new Error("ReDoc global missing after script load"));
    };
    script.onerror = () => reject(new Error("Failed to load ReDoc script"));
    document.head.appendChild(script);
  });
}
