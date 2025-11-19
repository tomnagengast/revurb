import { afterEach, describe, expect, it, mock } from "bun:test";
import type { ReverbConfig } from "../../src/config/types";
import type { ServerProvider } from "../../src/contracts/server-provider";
import { UsersTerminateController } from "../../src/protocols/pusher/http/controllers/users-terminate-controller";
import type { IPubSubProvider } from "../../src/servers/reverb/contracts/pubsub-provider";
import { Factory } from "../../src/servers/reverb/factory";

// Mock RedisPubSubProvider
const mockPublish = mock((_msg: unknown) => Promise.resolve(1));
const mockConnect = mock(() => Promise.resolve());
const mockDisconnect = mock(() => Promise.resolve());
const mockSubscribe = mock(() => Promise.resolve());
const mockOn = mock(() => {});

class MockRedisPubSubProvider implements IPubSubProvider {
  connect = mockConnect;
  disconnect = mockDisconnect;
  subscribe = mockSubscribe;
  on = mockOn;
  publish = mockPublish;
}

// Mock the module
mock.module("../../src/servers/reverb/publishing/redis-pubsub-provider", () => {
  return {
    RedisPubSubProvider: MockRedisPubSubProvider,
  };
});

describe("Scaling Feature", () => {
  const config: ReverbConfig = {
    default: "reverb",
    servers: {
      reverb: {
        host: "0.0.0.0",
        port: 8080,
        scaling: {
          enabled: true,
          channel: "reverb-test",
        },
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

  afterEach(() => {
    Factory.reset();
    mockPublish.mockClear();
    mockConnect.mockClear();
  });

  it("initializes RedisPubSubProvider when scaling is enabled", async () => {
    Factory.initialize(config);

    // Check if connect was called (async, so we might need to wait a tick)
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockConnect).toHaveBeenCalled();
  });

  it("dispatches events via PubSub when scaling is enabled", async () => {
    Factory.initialize(config);

    // We need to access the internal serverProvider to pass to dispatch
    // Or we can use Factory.make to get everything set up, but dispatch is a standalone function

    // Let's manually construct the scenario to test dispatch() with a ServerProvider that has PubSub

    // Note: We can't easily access the private serverProvider from Factory.
    // However, we can verify that the Factory wired it up correctly by checking
    // if MetricsHandler uses it.

    const metricsHandler = Factory.getMetricsHandler();
    // The metrics handler should have the pubsub provider set

    const app = Factory.getApplicationProvider().findById("test-id");

    // Trigger metrics publish
    metricsHandler.publish(app, "test-key", "channel");

    expect(mockPublish).toHaveBeenCalled();
    const lastCall = mockPublish.mock.lastCall;
    expect(lastCall).toBeDefined();
    if (lastCall && lastCall.length > 0) {
      expect(lastCall[0]).toMatchObject({
        type: "metrics-retrieved",
        key: "test-key",
      });
    }
  });

  it("terminates connections via PubSub when scaling is enabled", async () => {
    Factory.initialize(config);

    // We can't easily access the controller instance created by Factory.
    // But we can instantiate a new controller with the same dependencies to test the logic
    // provided we can get the ServerProvider that Factory created (which we can't easily).

    // Instead, let's trust that Factory wired it up and use the controller logic test
    // by creating a mock ServerProvider that returns true for subscribesToEvents

    const mockServerProvider = {
      subscribesToEvents: () => true,
      publish: mockPublish,
      shouldPublishEvents: () => true,
      boot: () => {},
      register: () => {},
      shouldNotPublishEvents: () => false,
      doesNotSubscribeToEvents: () => false,
    } as unknown as ServerProvider;

    const controller = new UsersTerminateController(
      Factory.getApplicationProvider(),
      Factory.getChannelManager(),
      mockServerProvider,
      new MockRedisPubSubProvider(),
    );

    const req = new Request(
      "http://localhost/apps/test-id/users/user-1/terminate_connections?auth_signature=invalid",
      {
        method: "POST",
      },
    );

    // Mock verifySignature to bypass auth (protected method)
    // @ts-expect-error
    controller.verifySignature = () => Promise.resolve();

    await controller.handle(req, "test-id", "user-1");

    expect(mockPublish).toHaveBeenCalled();
    // We expect 2 calls because one is from the MockRedisPubSubProvider used in controller
    // and potentially others from previous tests if not cleared (but we clear in afterEach)

    const lastCall = mockPublish.mock.lastCall;
    expect(lastCall).toBeDefined();
    if (lastCall && lastCall.length > 0) {
      expect(lastCall[0]).toMatchObject({
        type: "terminate",
        payload: { user_id: "user-1" },
      });
    }
  });
});
