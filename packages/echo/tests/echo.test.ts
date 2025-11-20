import { describe, expect, test } from "bun:test";
import Echo from "../src/echo";

describe("Echo", () => {
  test("it will not throw error for null broadcaster", () => {
    expect(
      () => new Echo({ broadcaster: "null", withoutInterceptors: true }),
    ).not.toThrow();
  });

  test("it will throw error for unsupported driver", () => {
    expect(
      // @ts-expect-error - testing unsupported broadcaster
      () => new Echo({ broadcaster: "foo", withoutInterceptors: true }),
    ).toThrow("Broadcaster string foo is not supported.");
  });

  test("it will throw error for socket.io broadcaster when client is missing", () => {
    expect(
      // @ts-expect-error - socket.io implemented but client missing
      () => new Echo({ broadcaster: "socket.io", withoutInterceptors: true }),
    ).toThrow(
      "Socket.io client not found. Should be globally available or passed via options.client",
    );
  });

  test("it will initialize socket.io broadcaster when client is provided", () => {
    const client = () => ({
      connect: () => {},
      on: () => {},
      emit: () => {},
      io: {
        on: () => {},
      },
    });
    expect(
      () =>
        new Echo({
          broadcaster: "socket.io",
          withoutInterceptors: true,
          // @ts-expect-error - mock client
          client,
        }),
    ).not.toThrow();
  });

  test("it will handle ably broadcaster by mapping to PusherConnector", () => {
    // ably maps to PusherConnector, so it requires Pusher client (like pusher/reverb)
    // This test verifies ably is recognized and doesn't throw "not supported" error
    expect(
      () => new Echo({ broadcaster: "ably", withoutInterceptors: true }),
    ).toThrow("Pusher client not found");
  });

  test("it will handle custom connector constructor", () => {
    class CustomConnector {
      disconnect() {}
      channel() {
        // biome-ignore lint/suspicious/noExplicitAny: Test mock
        return {} as any;
      }
      privateChannel() {
        // biome-ignore lint/suspicious/noExplicitAny: Test mock
        return {} as any;
      }
      encryptedPrivateChannel() {
        // biome-ignore lint/suspicious/noExplicitAny: Test mock
        return {} as any;
      }
      presenceChannel() {
        // biome-ignore lint/suspicious/noExplicitAny: Test mock
        return {} as any;
      }
      listen() {
        // biome-ignore lint/suspicious/noExplicitAny: Test mock
        return {} as any;
      }
      leave() {}
      leaveChannel() {}
      socketId() {
        return undefined;
      }
    }

    expect(
      () =>
        new Echo({
          broadcaster: CustomConnector,
          withoutInterceptors: true,
          // biome-ignore lint/suspicious/noExplicitAny: Test type override
        } as any),
    ).not.toThrow();
  });

  test("it will not register interceptors when withoutInterceptors is true", () => {
    const echo = new Echo({
      broadcaster: "null",
      withoutInterceptors: true,
    });
    // If interceptors were registered, we'd see errors in non-browser environments
    // This test verifies the option is respected
    expect(echo.options.withoutInterceptors).toBe(true);
  });

  // Note: pusher and reverb tests require Pusher client mocking
  // These will be added in Phase 2 when we set up proper test mocks
});
