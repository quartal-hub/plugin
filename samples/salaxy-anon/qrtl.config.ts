import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "Salaxy Anonymous API",
  description: "Provides methods from the Salaxy API that are available anonymously.",
  style: {
    logo: "https://cdn.salaxy.com/img/brand/salaxy-signature-640.png",
    skin: "https://cdn.salaxy.com/skins/bs5/salaxy.css",
    icons: [{ src: "https://cdn.salaxy.com/img/brand/icon-192.png", mimeType: "image/png", sizes: ["192x192"] }],
  },
  auth: "anon",
  deploy: { org: "quartal", app: "salaxy-anon" },
  // Widgets lazy-load @salaxy/* from esm.sh + Salaxy CDN inside the sandboxed iframe; allow those origins.
  widgets: {
    csp: {
      resourceDomains: [
        "https://cdn.salaxy.com", "https://esm.sh", "https://fonts.googleapis.com",
        "https://fonts.gstatic.com", "https://maxcdn.bootstrapcdn.com",
        "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net",
      ],
      connectDomains: ["https://cdn.salaxy.com", "https://esm.sh", "https://cdnjs.cloudflare.com"],
    },
  },
});
