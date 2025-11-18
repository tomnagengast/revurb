import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "bun";
import { Factory } from "revurb/src/servers/reverb/factory";

describe("Health Check Controller", () => {
  let server: Server;
  const port = 8082; // Use different port to avoid conflicts

  beforeAll(() => {
    // Set up test environment
    process.env.REVERB_APP_KEY = "test-key";
    process.env.REVERB_APP_SECRET = "test-secret";
    process.env.REVERB_APP_ID = "test-id";

    // Initialize factory
    Factory.initialize({
      apps: [
        {
          key: "test-key",
          secret: "test-secret",
          id: "test-id",
          name: "Test App",
          options: {},
        },
      ],
    });

    // Create server
    server = Factory.make("0.0.0.0", port, "");
  });

  afterAll(() => {
    if (server) {
      server.stop();
    }
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
