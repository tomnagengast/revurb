import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { ReverbConfig } from "revurb/src/config/types";
import { createServer, Factory } from "revurb/src/servers/reverb/factory";

describe("WebSocket Simple Test", () => {
  let result: Awaited<ReturnType<typeof createServer>>;
  let testPort: number;
  const testAppKey = "simple-test-key";
  const testAppSecret = "simple-test-secret";
  const testAppId = "simple-test-id";

  beforeAll(async () => {
    // Reset Factory state before creating server
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

    // Create test configuration with ephemeral port (0)
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
    testPort = result.server.port;

    // Give server time to start
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    await result.shutdown();
  });

  it("should connect and receive connection_established message", async () => {
    console.log("Creating WebSocket connection...");

    const messages: string[] = [];
    let connectionOpened = false;
    let connectionClosed = false;

    const result = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);

      ws.onopen = () => {
        console.log("Client: WebSocket opened");
        connectionOpened = true;
      };

      ws.onmessage = (event) => {
        console.log("Client: Received message:", event.data);
        messages.push(event.data);

        // Once we receive a message, close and resolve
        setTimeout(() => {
          ws.close();
          resolve({ messages, connectionOpened, connectionClosed });
        }, 100);
      };

      ws.onerror = (error) => {
        console.error("Client: WebSocket error:", error);
        resolve({ messages, connectionOpened, connectionClosed, error });
      };

      ws.onclose = () => {
        console.log("Client: WebSocket closed");
        connectionClosed = true;
        // Give a bit of time in case message arrives just before close
        setTimeout(() => {
          resolve({ messages, connectionOpened, connectionClosed });
        }, 100);
      };

      // Timeout after 3 seconds
      setTimeout(() => {
        if (!connectionClosed) {
          console.log("Client: Timeout - closing connection");
          ws.close();
        }
      }, 3000);
    });

    console.log("Test result:", result);

    expect(result.connectionOpened).toBe(true);
    expect(messages.length).toBeGreaterThan(0);

    if (messages.length > 0) {
      const firstMessage = JSON.parse(messages[0]);
      expect(firstMessage.event).toBe("pusher:connection_established");
    }
  }, 10000); // 10 second timeout for this test
});
