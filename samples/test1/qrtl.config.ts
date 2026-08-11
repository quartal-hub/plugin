import { defineQrtlConfig } from "@quartal/plugin";

export default defineQrtlConfig({
  title: "Test 1",
  description: "First test for Quartal Plugins.",
  style: {
    logo: "https://cdn.quartal.com/img/logo/quartal-logo-vertical.png",
    icons: [{ src: "https://cdn.quartal.com/img/logo/quartal-logo-q.png", mimeType: "image/png", sizes: ["128x128"] }],
  },
  auth: "anon",
  deploy: { org: "quartal", app: "test1" },
});
