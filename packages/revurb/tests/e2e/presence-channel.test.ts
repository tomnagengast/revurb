import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as crypto from "node:crypto";
import type { ReverbConfig } from "revurb/src/config/types";
import { createServer, Factory } from "revurb/src/servers/reverb/factory";
import type { PusherMessage } from "revurb/src/types/pusher-messages";

describe("Presence Channel E2E Tests", () => {
  let result: Awaited<ReturnType<typeof createServer>>;
  let testPort: number;
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
    // Reset Factory state before creating server
    Factory.reset();

    const config: ReverbConfig = {
      default: "reverb",
      servers: {
        reverb: {
          host: "127.0.0.1",
          port: 0,
          path: "",
        },
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

    result = await createServer({ config });
    if (!result.server.port) {
      throw new Error("Server port is undefined");
    }
    testPort = result.server.port;

    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    await result.shutdown();
  });

  it("should subscribe to a presence channel with valid auth and user data", async () => {
    const messages: PusherMessage[] = [];

    const res = await new Promise<{ socketId: string }>((resolve) => {
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
            resolve({ socketId });
          }, 100);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        resolve({ socketId });
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        ws.close();
        resolve({ socketId });
      }, 5000);
    });

    // Should have received connection_established and subscription_succeeded
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const events = messages.map((m) => m.event);
    expect(events).toContain("pusher:connection_established");
    expect(events).toContain("pusher_internal:subscription_succeeded");
    expect(res.socketId).toBeTruthy();

    // Check that subscription_succeeded includes presence hash and count
    const subscriptionSucceeded = messages.find(
      (m) => m.event === "pusher_internal:subscription_succeeded",
    );
    expect(subscriptionSucceeded).toBeTruthy();
    if (subscriptionSucceeded?.data) {
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

    const res = await new Promise<{ errorReceived: boolean }>((resolve) => {
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
            resolve({ errorReceived });
          }, 100);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        resolve({ errorReceived });
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        ws.close();
        resolve({ errorReceived });
      }, 5000);
    });

    // Should have received an error, not subscription_succeeded
    const events = messages.map((m) => m.event);
    expect(events).toContain("pusher:connection_established");
    expect(events).not.toContain("pusher_internal:subscription_succeeded");
    expect(res.errorReceived).toBe(true);
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
