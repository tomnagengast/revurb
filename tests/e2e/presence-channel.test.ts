import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as crypto from "node:crypto";
import type { Server } from "bun";
import type { ReverbConfig } from "../../src/config/types";
import { Factory } from "../../src/servers/reverb/factory";
import type { PusherMessage } from "../../src/types/pusher-messages";

describe("Presence Channel E2E Tests", () => {
  let server: Server;
  const testPort = 8087;
  const testAppKey = "presence-test-key";
  const testAppSecret = "presence-test-secret";
  const testAppId = "presence-test-id";

  /**
   * Generate Pusher-compatible auth signature for presence channels
   */
  function generatePresenceAuthSignature(
    socketId: string,
    channelName: string,
    channelData: string,
  ): string {
    const stringToSign = `${socketId}:${channelName}:${channelData}`;

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

  it("should subscribe to a presence channel with valid auth and user data", async () => {
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

          // Generate auth signature with user data for presence channel
          const channelName = "presence-test-channel";
          const userData = {
            user_id: "user-123",
            user_info: {
              name: "Test User",
              email: "test@example.com",
            },
          };
          const channelData = JSON.stringify(userData);
          const auth = generatePresenceAuthSignature(
            socketId,
            channelName,
            channelData,
          );

          console.log("Generated auth:", auth);
          console.log("Channel data:", channelData);

          ws.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: {
                channel: channelName,
                auth: auth,
                channel_data: channelData,
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

    // Check that subscription_succeeded includes presence hash and count
    const subscriptionSucceeded = messages.find(
      (m) => m.event === "pusher_internal:subscription_succeeded",
    );
    expect(subscriptionSucceeded).toBeTruthy();
    if (subscriptionSucceeded.data) {
      const subData =
        typeof subscriptionSucceeded.data === "string"
          ? JSON.parse(subscriptionSucceeded.data)
          : subscriptionSucceeded.data;
      // Presence channels should include presence info
      expect(subData).toHaveProperty("presence");
    }
  }, 10000);

  it("should reject presence channel subscription without channel_data", async () => {
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

          // Try to subscribe to presence channel WITHOUT channel_data
          const channelName = "presence-test-channel";
          const channelData = JSON.stringify({
            user_id: "user-123",
            user_info: { name: "Test User" },
          });
          const auth = generatePresenceAuthSignature(
            socketId,
            channelName,
            channelData,
          );

          ws.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: {
                channel: channelName,
                auth: auth,
                // channel_data is missing!
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

  it("should receive member_added event when another user joins", async () => {
    const messages1: PusherMessage[] = [];
    const messages2: PusherMessage[] = [];

    // Create first connection
    const ws1Promise = new Promise((resolve) => {
      const ws1 = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);
      let socketId = "";

      ws1.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("WS1 Received:", message.event);
        messages1.push(message);

        if (message.event === "pusher:connection_established") {
          const data = JSON.parse(message.data);
          socketId = data.socket_id;

          const channelName = "presence-multi-test-channel";
          const userData = {
            user_id: "user-1",
            user_info: { name: "User One" },
          };
          const channelData = JSON.stringify(userData);
          const auth = generatePresenceAuthSignature(
            socketId,
            channelName,
            channelData,
          );

          ws1.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: { channel: channelName, auth, channel_data: channelData },
            }),
          );
        }

        // Wait for member_added event from second connection
        if (message.event === "pusher_internal:member_added") {
          console.log("WS1: Received member_added event");
          setTimeout(() => {
            ws1.close();
            resolve({ messages: messages1, socketId });
          }, 200);
        }
      };

      // Keep connection alive
      setTimeout(() => {
        if (ws1.readyState === WebSocket.OPEN) {
          ws1.close();
          resolve({ messages: messages1, socketId });
        }
      }, 8000);
    });

    // Wait for first connection to be established
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create second connection
    const ws2Promise = new Promise((resolve) => {
      const ws2 = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);
      let socketId = "";

      ws2.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("WS2 Received:", message.event);
        messages2.push(message);

        if (message.event === "pusher:connection_established") {
          const data = JSON.parse(message.data);
          socketId = data.socket_id;

          const channelName = "presence-multi-test-channel";
          const userData = {
            user_id: "user-2",
            user_info: { name: "User Two" },
          };
          const channelData = JSON.stringify(userData);
          const auth = generatePresenceAuthSignature(
            socketId,
            channelName,
            channelData,
          );

          ws2.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: { channel: channelName, auth, channel_data: channelData },
            }),
          );
        }

        if (message.event === "pusher_internal:subscription_succeeded") {
          setTimeout(() => {
            ws2.close();
            resolve({ messages: messages2, socketId });
          }, 200);
        }
      };

      setTimeout(() => {
        if (ws2.readyState === WebSocket.OPEN) {
          ws2.close();
          resolve({ messages: messages2, socketId });
        }
      }, 8000);
    });

    const [_result1, _result2] = await Promise.all([ws1Promise, ws2Promise]);

    // First connection should receive member_added event
    const events1 = messages1.map((m) => m.event);
    expect(events1).toContain("pusher_internal:subscription_succeeded");
    expect(events1).toContain("pusher_internal:member_added");

    // Second connection should receive subscription_succeeded
    const events2 = messages2.map((m) => m.event);
    expect(events2).toContain("pusher_internal:subscription_succeeded");
  }, 15000);
});
