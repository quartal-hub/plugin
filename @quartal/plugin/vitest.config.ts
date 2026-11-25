import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The codegen tests run the TypeScript compiler (ts-morph); with every test file in parallel they
    // take several seconds on a loaded machine, past vitest's 5 s default.
    testTimeout: 20_000,
  },
});
