import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as crypto from "node:crypto";
import type { Server } from "bun";
import type { ReverbConfig } from "../../src/config/types";
import { Factory } from "../../src/servers/reverb/factory";
import type { PusherMessage } from "../../src/types/pusher-messages";

describe("Private Channel E2E Tests", () => {
  let server: Server;
  const testPort = 8086;
  const testAppKey = "private-test-key";
  const testAppSecret = "private-test-secret";
  const testAppId = "private-test-id";

  /**
   * Generate Pusher-compatible auth signature for private channels
   */
  function generateAuthSignature(
    socketId: string,
    channelName: string,
    channelData?: string,
  ): string {
    let stringToSign = `${socketId}:${channelName}`;
    if (channelData) {
      stringToSign += `:${channelData}`;
    }

    const hmac = crypto.createHmac("sha256", testAppSecret);
    hmac.update(stringToSign);
    const signature = hmac.digest("hex");

    return `${testAppKey}:${signature}`;
  }

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

  it("should subscribe to a private channel with valid auth", async () => {
    const messages: PusherMessage[] = [];

    const result = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);
      let socketId = "";

      ws.onopen = () => {
        console.log("Connected to WebSocket");
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("Received:", message.event);
        messages.push(message);

        if (message.event === "pusher:connection_established") {
          const data = JSON.parse(message.data);
          socketId = data.socket_id;
          console.log("Socket ID:", socketId);

          // Generate auth signature and subscribe
          const channelName = "private-test-channel";
          const auth = generateAuthSignature(socketId, channelName);
          console.log("Generated auth:", auth);

          ws.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: {
                channel: channelName,
                auth: auth,
              },
            }),
          );
        }

        // After receiving subscription_succeeded, close
        if (message.event === "pusher_internal:subscription_succeeded") {
          setTimeout(() => {
            ws.close();
            resolve({ messages, socketId });
          }, 100);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        resolve({ messages, socketId, error });
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        ws.close();
        resolve({ messages, socketId });
      }, 5000);
    });

    // Should have received connection_established and subscription_succeeded
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const events = messages.map((m) => m.event);
    expect(events).toContain("pusher:connection_established");
    expect(events).toContain("pusher_internal:subscription_succeeded");
    expect(result.socketId).toBeTruthy();
  }, 10000);

  it("should reject private channel subscription with invalid auth", async () => {
    const messages: PusherMessage[] = [];

    const result = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);
      let socketId = "";
      let errorReceived = false;

      ws.onopen = () => {
        console.log("Connected to WebSocket");
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("Received:", message.event);
        messages.push(message);

        if (message.event === "pusher:connection_established") {
          const data = JSON.parse(message.data);
          socketId = data.socket_id;
          console.log("Socket ID:", socketId);

          // Subscribe with INVALID auth
          const channelName = "private-test-channel";
          const invalidAuth = `${testAppKey}:invalid_signature`;
          console.log("Using invalid auth:", invalidAuth);

          ws.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: {
                channel: channelName,
                auth: invalidAuth,
              },
            }),
          );
        }

        // Look for error response
        if (message.event === "pusher:error") {
          errorReceived = true;
          setTimeout(() => {
            ws.close();
            resolve({ messages, socketId, errorReceived });
          }, 100);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        resolve({ messages, socketId, errorReceived, error });
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        ws.close();
        resolve({ messages, socketId, errorReceived });
      }, 5000);
    });

    // Should have received an error, not subscription_succeeded
    const events = messages.map((m) => m.event);
    expect(events).toContain("pusher:connection_established");
    expect(events).not.toContain("pusher_internal:subscription_succeeded");
    expect(result.errorReceived).toBe(true);
  }, 10000);

  it("should reject private channel subscription without auth", async () => {
    const messages: PusherMessage[] = [];

    const result = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);
      let socketId = "";
      let errorReceived = false;

      ws.onopen = () => {
        console.log("Connected to WebSocket");
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("Received:", message.event);
        messages.push(message);

        if (message.event === "pusher:connection_established") {
          const data = JSON.parse(message.data);
          socketId = data.socket_id;
          console.log("Socket ID:", socketId);

          // Subscribe WITHOUT auth (should fail)
          const channelName = "private-test-channel";

          ws.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: {
                channel: channelName,
                // auth is missing!
              },
            }),
          );
        }

        // Look for error response
        if (message.event === "pusher:error") {
          errorReceived = true;
          setTimeout(() => {
            ws.close();
            resolve({ messages, socketId, errorReceived });
          }, 100);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        resolve({ messages, socketId, errorReceived, error });
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        ws.close();
        resolve({ messages, socketId, errorReceived });
      }, 5000);
    });

    // Should have received an error, not subscription_succeeded
    const events = messages.map((m) => m.event);
    expect(events).toContain("pusher:connection_established");
    expect(events).not.toContain("pusher_internal:subscription_succeeded");
    expect(result.errorReceived).toBe(true);
  }, 10000);
});
