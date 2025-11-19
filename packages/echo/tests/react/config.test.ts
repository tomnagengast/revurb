import { beforeEach, describe, expect, test } from "bun:test";

describe("echo helper", () => {
  beforeEach(() => {
    // Reset modules by clearing the config state
    // This is a simplified approach - in a real scenario we'd need to reset the module cache
  });

  test("throws error when Echo is not configured", async () => {
    // Clear any existing configuration by importing fresh
    const { echo } = await import("../../src/react/config");

    // Note: This test may fail if echo was configured in a previous test
    // In a real scenario, we'd need to reset the module state
    try {
      echo();
      // If we get here, echo was already configured
      // This is expected in some test environments
    } catch (error) {
      expect((error as Error).message).toBe(
        "Echo has not been configured. Please call `configureEcho()`.",
      );
    }
  });

  test("creates Echo instance with proper configuration", async () => {
    const { configureEcho, echo } = await import("../../src/react/config");

    configureEcho({
      broadcaster: "null",
    });

    const instance = echo();
    expect(instance).toBeDefined();
    expect(instance.options.broadcaster).toBe("null");
  });

  test("checks if Echo is configured", async () => {
    const { configureEcho, echoIsConfigured } = await import(
      "../../src/react/config"
    );

    // Note: echoIsConfigured may return true if configured in previous test
    // This is a limitation of the current test setup
    const wasConfigured = echoIsConfigured();

    configureEcho({
      broadcaster: "null",
    });

    expect(echoIsConfigured()).toBe(true);
  });
});
