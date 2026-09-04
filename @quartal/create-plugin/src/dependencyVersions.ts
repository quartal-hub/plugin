/**
 * Dependency version ranges written into a scaffolded plugin's `package.json`.
 * Kept in one place so releases only need to bump this file. The `@quartal/*` ranges should track
 * the versions published from this workspace.
 */
export const DEPENDENCY_VERSIONS: Record<string, string> = {
  "@astrojs/node": "^11.0.0",
  "@astrojs/react": "^6.0.0",
  "@astrojs/vue": "^7.0.0",
  "@quartal/plugin": "^0.6.0",
  "@quartal/plugin-core": "^0.6.0",
  "@quartal/plugin-vue": "^0.5.3",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  astro: "^7.0.0",
  react: "^19.0.0",
  "react-dom": "^19.0.0",
  vue: "^3.5.0",
};
