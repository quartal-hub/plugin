import tsParser from "@typescript-eslint/parser";
import importX from "eslint-plugin-import-x";

/**
 * Import-hygiene lint for the whole workspace. Enforces the module conventions documented in
 * CONTRIBUTING.md: no import cycles, ordered import blocks, explicit `.ts` extensions on relative
 * imports, and no importing your own folder's (or parent's) barrel.
 */
export default [
  {
    ignores: [
      "**/dist/**",
      "**/dist-storybook/**",
      "**/node_modules/**",
      "**/static/**",
      "**/.astro/**",
      "**/qrtl-plugin/**",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver": {
        typescript: {
          project: ["@quartal/*/tsconfig.json", "samples/*/tsconfig.json"],
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      "import-x/no-cycle": ["error", { ignoreExternal: true }],
      "import-x/no-self-import": "error",
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", ["internal", "parent", "sibling", "index"]],
          "newlines-between": "ignore",
        },
      ],
      "import-x/extensions": ["error", "ignorePackages", { ts: "always", vue: "always" }],
      // A folder must never import its own barrel (`./index.ts`) or its parent's (`../index.ts`) —
      // the barrel re-exports the importing file, which is a cycle. Named folder barrels like
      // `../model/index.ts` are the sanctioned way to consume another folder.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./index.ts", "../index.ts"],
              message: "Do not import your own folder's or parent's barrel; import the concrete file instead.",
            },
          ],
        },
      ],
    },
  },
];
