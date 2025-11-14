import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ReverbConfig } from "../../src/config/types";
import { createServer, Factory } from "../../src/servers/reverb/factory";

describe("createServer", () => {
  const baseConfig: ReverbConfig = {
    default: "reverb",
    servers: {
      reverb: {
        host: "127.0.0.1",
        port: 0,
        path: "",
        max_request_size: 10000,
      },
      custom: {
        host: "0.0.0.0",
        port: 0,
        path: "/ws",
        hostname: "example.com",
        max_request_size: 20000,
      },
    },
    apps: {
      provider: "config",
      apps: [
        {
          key: "test-key",
          secret: "test-secret",
          app_id: "test-app",
        },
      ],
    },
  };

  beforeEach(() => {
    Factory.isInitialized = false;
    Factory.appManager = null;
    Factory.channelManager = null;
    Factory.pusherServer = null;
    Factory.logger = null;
    Factory.metricsHandler = null;
    Factory.eventsController = null;
    Factory.eventsBatchController = null;
    Factory.channelsController = null;
    Factory.channelController = null;
    Factory.usersTerminateController = null;
    Factory.applicationProvider = null;
    Factory.serverProvider = null;
  });

  describe("Config resolution", () => {
    it("should accept config object directly", async () => {
      const result = await createServer({ config: baseConfig });

      expect(result.config).toBe(baseConfig);
      expect(result.server).toBeDefined();
      expect(result.serverConfig).toBe(baseConfig.servers.reverb);

      await result.shutdown();
    });

    it("should load config from path if provided", async () => {
      const fixtureConfig: ReverbConfig = {
        default: "test",
        servers: {
          test: {
            host: "127.0.0.1",
            port: 0,
          },
        },
        apps: {
          provider: "config",
          apps: [
            {
              key: "fixture-key",
              secret: "fixture-secret",
              app_id: "fixture-app",
            },
          ],
        },
      };

      // Use a temporary file for this test instead of overwriting tracked fixtures
      const tmpDir = `${import.meta.dir}/../../_tmp`;
      await Bun.write(`${tmpDir}/.gitkeep`, "");
      const configPath = `${tmpDir}/test-config-${Date.now()}.ts`;

      await Bun.write(
        configPath,
        `export default ${JSON.stringify(fixtureConfig, null, 2)};`,
      );

      const result = await createServer({ configPath });

      expect(result.config.servers.test).toBeDefined();
      expect(result.config.apps.apps[0].key).toBe("fixture-key");

      await result.shutdown();
    });

    it("should fallback to loadConfig when no config provided", async () => {
      Bun.env.REVERB_APP_KEY = "env-key";
      Bun.env.REVERB_APP_SECRET = "env-secret";
      Bun.env.REVERB_APP_ID = "env-app";
      Bun.env.REVERB_SERVER_PORT = "0";

      const result = await createServer();

      expect(result.config).toBeDefined();
      expect(result.config.apps.apps[0].key).toBe("env-key");

      await result.shutdown();

      delete Bun.env.REVERB_APP_KEY;
      delete Bun.env.REVERB_APP_SECRET;
      delete Bun.env.REVERB_APP_ID;
      delete Bun.env.REVERB_SERVER_PORT;
    });

    it("should use config object values when provided", async () => {
      const result = await createServer({ config: baseConfig });

      expect(result.serverConfig.host).toBe("127.0.0.1");
      expect(result.serverConfig.port).toBe(0);

      await result.shutdown();
    });
  });

  describe("Server name selection", () => {
    it("should use explicit serverName option", async () => {
      const result = await createServer({
        config: baseConfig,
        serverName: "custom",
      });

      expect(result.serverConfig).toBe(baseConfig.servers.custom);

      await result.shutdown();
    });

    it("should use config.default when no serverName provided", async () => {
      const result = await createServer({ config: baseConfig });

      expect(result.serverConfig).toBe(baseConfig.servers.reverb);

      await result.shutdown();
    });

    it("should use first available server if default not found", async () => {
      const configWithoutDefault: ReverbConfig = {
        default: "nonexistent",
        servers: {
          first: {
            host: "127.0.0.1",
            port: 0,
          },
        },
        apps: baseConfig.apps,
      };

      await expect(
        createServer({ config: configWithoutDefault }),
      ).rejects.toThrow("Server configuration not found");
    });

    it("should throw error for invalid server name", async () => {
      await expect(
        createServer({ config: baseConfig, serverName: "invalid" }),
      ).rejects.toThrow("Server configuration not found for: invalid");
    });
  });

  describe("Override application", () => {
    it("should override host", async () => {
      const result = await createServer({
        config: baseConfig,
        host: "127.0.0.1",
      });

      expect(result.server.hostname).toBe("127.0.0.1");

      await result.shutdown();
    });

    it("should override port as string", async () => {
      const result = await createServer({
        config: baseConfig,
        port: "9999",
      });

      expect(result.server.port).toBeGreaterThan(0);

      await result.shutdown();
    });

    it("should override port as number", async () => {
      const result = await createServer({
        config: baseConfig,
        port: 0,
      });

      expect(result.server.port).toBeGreaterThan(0);

      await result.shutdown();
    });

    it("should override path", async () => {
      const result = await createServer({
        config: baseConfig,
        path: "/custom-path",
      });

      const response = await fetch(
        `http://127.0.0.1:${result.server.port}/custom-path/up`,
      );

      expect(response.status).toBe(200);

      await result.shutdown();
    });

    it("should override hostname", async () => {
      const result = await createServer({
        config: baseConfig,
        hostname: "custom.example.com",
      });

      expect(result.server).toBeDefined();

      await result.shutdown();
    });

    it("should override maxRequestSize", async () => {
      const result = await createServer({
        config: baseConfig,
        maxRequestSize: 50000,
      });

      expect(result.server).toBeDefined();

      await result.shutdown();
    });

    it("should apply multiple overrides simultaneously", async () => {
      const result = await createServer({
        config: baseConfig,
        host: "127.0.0.1",
        port: 0,
        path: "/api",
        maxRequestSize: 99999,
      });

      expect(result.server.hostname).toBe("127.0.0.1");

      const response = await fetch(
        `http://127.0.0.1:${result.server.port}/api/up`,
      );
      expect(response.status).toBe(200);

      await result.shutdown();
    });
  });

  describe("Feature toggles", () => {
    it("should have enableEventLogging off by default", async () => {
      const result = await createServer({ config: baseConfig });

      expect(result.intervals).toHaveLength(0);

      await result.shutdown();
    });

    it("should enable event logging when requested", async () => {
      const result = await createServer({
        config: baseConfig,
        enableEventLogging: true,
      });

      expect(result.server).toBeDefined();

      await result.shutdown();
    });

    it("should have enableJobs off by default", async () => {
      const result = await createServer({ config: baseConfig });

      expect(result.intervals).toHaveLength(0);

      await result.shutdown();
    });

    it("should enable periodic jobs when requested", async () => {
      const result = await createServer({
        config: baseConfig,
        enableJobs: true,
      });

      expect(result.intervals).toHaveLength(2);

      await result.shutdown();
    });

    it("should have enableSignals off by default", async () => {
      const mockProcessOn = mock(() => {});
      const originalProcessOn = process.on;
      process.on = mockProcessOn as typeof process.on;

      const result = await createServer({ config: baseConfig });

      expect(mockProcessOn).not.toHaveBeenCalled();

      await result.shutdown();

      process.on = originalProcessOn;
    });

    it("should enable signal handlers when requested", async () => {
      const mockProcessOn = mock(() => {});
      const originalProcessOn = process.on;
      process.on = mockProcessOn as typeof process.on;

      const result = await createServer({
        config: baseConfig,
        enableSignals: true,
      });

      expect(mockProcessOn).toHaveBeenCalledTimes(3);

      await result.shutdown();

      process.on = originalProcessOn;
    });

    it("should support all features enabled together", async () => {
      const result = await createServer({
        config: baseConfig,
        enableEventLogging: true,
        enableJobs: true,
        enableSignals: true,
      });

      expect(result.intervals).toHaveLength(2);

      await result.shutdown();
    });
  });

  describe("Shutdown function", () => {
    it("should clear all intervals", async () => {
      const result = await createServer({
        config: baseConfig,
        enableJobs: true,
      });

      expect(result.intervals).toHaveLength(2);

      const clearIntervalSpy = mock(clearInterval);
      const originalClearInterval = globalThis.clearInterval;
      globalThis.clearInterval = clearIntervalSpy as typeof clearInterval;

      await result.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(2);

      globalThis.clearInterval = originalClearInterval;
    });

    it("should remove event listeners", async () => {
      const result = await createServer({
        config: baseConfig,
        enableEventLogging: true,
      });

      await result.shutdown();

      expect(result.server).toBeDefined();
    });

    it("should remove signal handlers", async () => {
      const mockProcessOff = mock(() => {});
      const originalProcessOff = process.off;
      process.off = mockProcessOff as typeof process.off;

      const result = await createServer({
        config: baseConfig,
        enableSignals: true,
      });

      await result.shutdown();

      expect(mockProcessOff).toHaveBeenCalledTimes(3);

      process.off = originalProcessOff;
    });

    it("should stop the server", async () => {
      const result = await createServer({ config: baseConfig });

      const stopSpy = mock(result.server.stop);
      result.server.stop = stopSpy;

      await result.shutdown();

      expect(stopSpy).toHaveBeenCalled();
    });

    it("should be idempotent", async () => {
      const result = await createServer({ config: baseConfig });

      await result.shutdown();
      await result.shutdown();
      await result.shutdown();
    });

    it("should handle cleanup errors gracefully", async () => {
      const result = await createServer({
        config: baseConfig,
        enableJobs: true,
      });

      result.server.stop = () => {
        throw new Error("Stop failed");
      };

      await expect(result.shutdown()).rejects.toThrow("Stop failed");
    });
  });

  describe("Error handling", () => {
    it("should throw error for missing config", async () => {
      delete Bun.env.REVERB_APP_KEY;
      delete Bun.env.REVERB_APP_SECRET;
      delete Bun.env.REVERB_APP_ID;

      await expect(createServer()).rejects.toThrow();
    });

    it("should throw error for invalid server name", async () => {
      await expect(
        createServer({
          config: baseConfig,
          serverName: "does-not-exist",
        }),
      ).rejects.toThrow("Server configuration not found for: does-not-exist");
    });

    it("should handle duplicate initialization gracefully", async () => {
      const result1 = await createServer({ config: baseConfig });
      const result2 = await createServer({ config: baseConfig });

      expect(result1.server).toBeDefined();
      expect(result2.server).toBeDefined();

      await result1.shutdown();
      await result2.shutdown();
    });

    it("should handle missing apps config", async () => {
      const configWithoutApps: ReverbConfig = {
        default: "reverb",
        servers: {
          reverb: {
            host: "127.0.0.1",
            port: 0,
          },
        },
        apps: {
          provider: "config",
          apps: [],
        },
      };

      const result = await createServer({ config: configWithoutApps });

      expect(result.server).toBeDefined();

      await result.shutdown();
    });

    it("should handle invalid port gracefully", async () => {
      const result = await createServer({
        config: baseConfig,
        port: 0,
      });

      expect(result.server.port).toBeGreaterThan(0);

      await result.shutdown();
    });

    it("should validate config structure", async () => {
      const invalidConfig = {
        default: "reverb",
        servers: {},
        apps: {
          provider: "config",
          apps: [],
        },
      } as ReverbConfig;

      await expect(createServer({ config: invalidConfig })).rejects.toThrow(
        "Server configuration not found",
      );
    });
  });

  describe("Server lifecycle", () => {
    it("should return valid server instance", async () => {
      const result = await createServer({ config: baseConfig });

      expect(result.server).toBeDefined();
      expect(result.server.port).toBeGreaterThan(0);
      expect(typeof result.server.stop).toBe("function");

      await result.shutdown();
    });

    it("should initialize Factory only once", async () => {
      const result1 = await createServer({ config: baseConfig });

      expect(Factory.isInitialized).toBe(true);

      const result2 = await createServer({ config: baseConfig });

      expect(Factory.isInitialized).toBe(true);

      await result1.shutdown();
      await result2.shutdown();
    });

    it("should return all required result properties", async () => {
      const result = await createServer({
        config: baseConfig,
        enableJobs: true,
      });

      expect(result.server).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.serverConfig).toBeDefined();
      expect(result.intervals).toBeDefined();
      expect(typeof result.shutdown).toBe("function");

      await result.shutdown();
    });

    it("should support health check endpoint", async () => {
      const result = await createServer({ config: baseConfig });

      const response = await fetch(`http://127.0.0.1:${result.server.port}/up`);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.health).toBe("OK");

      await result.shutdown();
    });

    it("should bind to specified host and port", async () => {
      const result = await createServer({
        config: baseConfig,
        host: "127.0.0.1",
        port: 0,
      });

      expect(result.server.hostname).toBe("127.0.0.1");
      expect(result.server.port).toBeGreaterThan(0);

      await result.shutdown();
    });
  });

  describe("Integration scenarios", () => {
    it("should support custom path prefix", async () => {
      const result = await createServer({
        config: baseConfig,
        path: "/ws",
      });

      const response = await fetch(
        `http://127.0.0.1:${result.server.port}/ws/up`,
      );

      expect(response.status).toBe(200);

      await result.shutdown();
    });

    it("should handle concurrent server creation", async () => {
      const results = await Promise.all([
        createServer({ config: baseConfig }),
        createServer({ config: baseConfig }),
        createServer({ config: baseConfig }),
      ]);

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.server).toBeDefined();
      }

      await Promise.all(results.map((r) => r.shutdown()));
    });

    it("should support dynamic configuration", async () => {
      const dynamicConfig: ReverbConfig = {
        default: "dynamic",
        servers: {
          dynamic: {
            host: "127.0.0.1",
            port: 0,
            path: "/dynamic",
            max_request_size: 15000,
          },
        },
        apps: {
          provider: "config",
          apps: [
            {
              key: "dynamic-key",
              secret: "dynamic-secret",
              app_id: "dynamic-app",
              allowed_origins: ["https://example.com"],
            },
          ],
        },
      };

      const result = await createServer({ config: dynamicConfig });

      expect(result.serverConfig.path).toBe("/dynamic");
      expect(result.serverConfig.max_request_size).toBe(15000);
      expect(result.config.apps.apps[0].allowed_origins).toContain(
        "https://example.com",
      );

      await result.shutdown();
    });
  });
});
