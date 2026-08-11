import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "Auth Agent",
  description: "First test with an authenticated agent for Quartal Plugins.",
  style: {
    logo: "https://cdn.quartal.com/img/logo/quartal-logo-vertical.png",
    icons: [{ src: "https://cdn.quartal.com/img/logo/quartal-logo-q.png", mimeType: "image/png", sizes: ["128x128"] }],
  },
  auth: "quartal-iam",
  deploy: { org: "quartal", app: "auth-agent" },
});
