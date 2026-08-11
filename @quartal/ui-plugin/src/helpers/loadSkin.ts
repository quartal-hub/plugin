/** Default Quartal Bootstrap skin (CDN). */
export const DEFAULT_SKIN_URL = "https://cdn.quartal.com/skins/default.css";

const SKIN_LINK_ID = "quartalSkin";

/** Injects or updates the Quartal skin stylesheet on the page. */
export function loadSkin(url: string = DEFAULT_SKIN_URL): void {
  if (typeof document === "undefined") return;

  let link = document.getElementById(SKIN_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = SKIN_LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = url;
}

/** Loads the default Quartal skin. Call from Storybook preview or app bootstrap. */
export function loadDefaultSkin(): void {
  loadSkin(DEFAULT_SKIN_URL);
}
