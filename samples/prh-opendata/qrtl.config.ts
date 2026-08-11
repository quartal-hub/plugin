import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "PRH Open Data",
  description: "Anonymous integration to the Finnish Patent and Registration Office (PRH) Open Data APIs: company register (YTJ), financial statements (XBRL) and registered notices. Optimized for MCP tool use by agents.",
  style: {
    logo: "https://cdn.quartal.com/img/integrations/icon/prh.png",
    icons: [{ src: "https://cdn.quartal.com/img/integrations/icon/prh.png", mimeType: "image/png", sizes: ["192x192"] }],
  },
  auth: "anon",
  deploy: { org: "quartal", app: "prh-opendata" },
  widgets: {
    csp: {
      resourceDomains: [
        "https://cdn.quartal.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com",
        "https://maxcdn.bootstrapcdn.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net",
      ],
      connectDomains: ["https://cdn.quartal.com", "https://cdnjs.cloudflare.com"],
    },
  },
});
