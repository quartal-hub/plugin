import { afterEach, describe, expect, it, vi } from "vitest";
import { Helpers } from "../src/index.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Helpers.getEnvVar", () => {
  it("returns strings and leaves absent optional variables undefined", () => {
    vi.stubEnv("QRTL_TEST_ENV_STRING", "configured");

    expect(Helpers.getEnvVar("QRTL_TEST_ENV_STRING", "string")).toBe("configured");
    expect(Helpers.getEnvVar("QRTL_TEST_ENV_ABSENT", "string?")).toBeUndefined();
  });

  it("parses finite numbers", () => {
    vi.stubEnv("QRTL_TEST_ENV_NUMBER", "12.5");
    vi.stubEnv("QRTL_TEST_ENV_BAD_NUMBER", "Infinity");

    expect(Helpers.getEnvVar("QRTL_TEST_ENV_NUMBER", "number")).toBe(12.5);
    expect(() => Helpers.getEnvVar("QRTL_TEST_ENV_BAD_NUMBER", "number?")).toThrow(/valid number/);
  });

  it("parses booleans without accepting other non-empty values", () => {
    vi.stubEnv("QRTL_TEST_ENV_TRUE", "true");
    vi.stubEnv("QRTL_TEST_ENV_FALSE", "FALSE");
    vi.stubEnv("QRTL_TEST_ENV_BAD_BOOLEAN", "yes");

    expect(Helpers.getEnvVar("QRTL_TEST_ENV_TRUE", "boolean")).toBe(true);
    expect(Helpers.getEnvVar("QRTL_TEST_ENV_FALSE", "boolean?")).toBe(false);
    expect(() => Helpers.getEnvVar("QRTL_TEST_ENV_BAD_BOOLEAN", "boolean?")).toThrow(/"true" or "false"/);
  });

  it("throws for missing or empty required variables", () => {
    vi.stubEnv("QRTL_TEST_ENV_EMPTY", "  ");

    expect(() => Helpers.getEnvVar("QRTL_TEST_ENV_MISSING", "string")).toThrow(/not set or is empty/);
    expect(() => Helpers.getEnvVar("QRTL_TEST_ENV_EMPTY", "number")).toThrow(/not set or is empty/);
  });

  it("returns undefined for missing or empty optional variables", () => {
    vi.stubEnv("QRTL_TEST_ENV_OPTIONAL_EMPTY", "");

    expect(Helpers.getEnvVar("QRTL_TEST_ENV_OPTIONAL_MISSING", "number?")).toBeUndefined();
    expect(Helpers.getEnvVar("QRTL_TEST_ENV_OPTIONAL_EMPTY", "boolean?")).toBeUndefined();
  });
});
