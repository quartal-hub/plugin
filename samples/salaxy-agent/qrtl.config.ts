import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "Salaxy Agent",
  description: "Simple API that uses an Agent to execute tasks on Salaxy API.",
  style: {
    logo: "https://cdn.salaxy.com/img/brand/salaxy-signature-640.png",
    icons: [{ src: "https://cdn.salaxy.com/img/brand/icon-192.png", mimeType: "image/png", sizes: ["192x192"] }],
  },
  auth: "quartal-iam",
  deploy: { org: "quartal", app: "salaxy-agent" },
});
