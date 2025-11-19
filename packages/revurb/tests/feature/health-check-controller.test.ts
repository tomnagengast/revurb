import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "bun";
import type { ReverbConfig } from "../../src/config/types";
import { Factory } from "../../src/servers/reverb/factory";

describe("Health Check Controller", () => {
  let server: Server<unknown>;
  let port: number;

  beforeAll(() => {
    // Set up test environment
    process.env.REVERB_APP_KEY = "test-key";
    process.env.REVERB_APP_SECRET = "test-secret";
    process.env.REVERB_APP_ID = "test-id";

    const config: ReverbConfig = {
      default: "reverb",
      servers: {
        reverb: {
          host: "0.0.0.0",
          port: 8080,
          scaling: { enabled: false },
        },
      },
      apps: {
        provider: "config",
        apps: [
          {
            key: "test-key",
            secret: "test-secret",
            app_id: "test-id",
            options: {},
            allowed_origins: ["*"],
            ping_interval: 60,
            activity_timeout: 30,
            max_message_size: 10000,
          },
        ],
      },
    };

    // Initialize factory
    Factory.initialize(config);

    // Create server with port 0 (let Bun pick a random available port)
    server = Factory.make("0.0.0.0", "0", "") as unknown as Server<unknown>;
    if (!server.port) {
      throw new Error("Server port is undefined");
    }
    port = server.port;
  });

  afterAll(() => {
    if (server) {
      server.stop();
    }
    Factory.reset();
  });

  it("can respond to a health check request", async () => {
    const response = await fetch(`http://localhost:${port}/up`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const text = await response.text();
    expect(text).toBe('{"health":"OK"}');
  });

  it("health check does not require app ID", async () => {
    // Health check endpoint should work without any authentication
    const response = await fetch(`http://localhost:${port}/up`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const text = await response.text();
    expect(text).toBe('{"health":"OK"}');
  });
});
