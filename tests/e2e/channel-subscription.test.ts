import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "bun";
import type { ReverbConfig } from "../../src/config/types";
import { Factory } from "../../src/servers/reverb/factory";

describe("Channel Subscription E2E Tests", () => {
  let server: Server;
  const testPort = 8085;
  const testAppKey = "channel-test-key";
  const testAppSecret = "channel-test-secret";
  const testAppId = "channel-test-id";

  beforeAll(async () => {
    const config: ReverbConfig = {
      server: {
        host: "127.0.0.1",
        port: testPort,
        path: "",
      },
      apps: {
        provider: "config",
        apps: [
          {
            key: testAppKey,
            secret: testAppSecret,
            app_id: testAppId,
            allowed_origins: ["*"],
            ping_interval: 60,
            activity_timeout: 120,
          },
        ],
      },
    };

    Factory.initialize(config);

    const host = config.server?.host || "127.0.0.1";
    const port = config.server?.port?.toString() || testPort.toString();
    const path = config.server?.path || "";
    const hostname = config.server?.hostname;
    const maxRequestSize = config.server?.max_request_size || 10000;
    const options = {
      tls: config.server?.options?.tls || {},
    };
    const protocol = "pusher";

    server = Factory.make(
      host,
      port,
      path,
      hostname,
      maxRequestSize,
      options,
      protocol,
    );

    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(() => {
    if (server) {
      server.stop();
    }
  });

  it("should subscribe to a public channel", async () => {
    const messages: unknown[] = [];

    const _result = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);

      ws.onopen = () => {
        console.log("Connected, subscribing to channel...");
        // Subscribe to a public channel
        ws.send(
          JSON.stringify({
            event: "pusher:subscribe",
            data: {
              channel: "test-channel",
            },
          }),
        );
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("Received:", message.event);
        messages.push(message);

        // After receiving subscription_succeeded, close
        if (message.event === "pusher_internal:subscription_succeeded") {
          setTimeout(() => {
            ws.close();
            resolve({ messages });
          }, 100);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        resolve({ messages, error });
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        ws.close();
        resolve({ messages });
      }, 5000);
    });

    // Should have received connection_established and subscription_succeeded
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const events = messages.map((m) => m.event);
    expect(events).toContain("pusher:connection_established");
    expect(events).toContain("pusher_internal:subscription_succeeded");
  }, 10000);

  it("should handle ping/pong", async () => {
    const messages: unknown[] = [];

    const result = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);
      let connected = false;

      ws.onopen = () => {
        connected = true;
        // Wait for connection_established, then send ping
        setTimeout(() => {
          console.log("Sending ping...");
          ws.send(
            JSON.stringify({
              event: "pusher:ping",
              data: {},
            }),
          );
        }, 200);
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("Received:", message.event);
        messages.push(message);

        // After receiving pong, close
        if (message.event === "pusher:pong") {
          setTimeout(() => {
            ws.close();
            resolve({ connected, messages });
          }, 100);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        resolve({ connected, messages, error });
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        ws.close();
        resolve({ connected, messages });
      }, 5000);
    });

    expect(result.connected).toBe(true);
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const events = messages.map((m) => m.event);
    expect(events).toContain("pusher:connection_established");
    expect(events).toContain("pusher:pong");
  }, 10000);

  it("should unsubscribe from a channel", async () => {
    const messages: unknown[] = [];

    const result = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);
      let subscribed = false;

      ws.onopen = () => {
        // Subscribe first
        ws.send(
          JSON.stringify({
            event: "pusher:subscribe",
            data: {
              channel: "unsubscribe-test-channel",
            },
          }),
        );
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("Received:", message.event);
        messages.push(message);

        // After subscription succeeded, unsubscribe
        if (message.event === "pusher_internal:subscription_succeeded") {
          subscribed = true;
          setTimeout(() => {
            console.log("Unsubscribing...");
            ws.send(
              JSON.stringify({
                event: "pusher:unsubscribe",
                data: {
                  channel: "unsubscribe-test-channel",
                },
              }),
            );

            // Close after unsubscribe
            setTimeout(() => {
              ws.close();
              resolve({ subscribed, messages });
            }, 200);
          }, 100);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        resolve({ subscribed, messages, error });
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        ws.close();
        resolve({ subscribed, messages });
      }, 5000);
    });

    expect(result.subscribed).toBe(true);
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const events = messages.map((m) => m.event);
    expect(events).toContain("pusher:connection_established");
    expect(events).toContain("pusher_internal:subscription_succeeded");
    // Unsubscribe doesn't send a response in Pusher protocol
  }, 10000);
});
