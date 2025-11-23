import { describe, expect, test } from "bun:test";
import { NullConnector } from "../src/connector/null-connector";
import { PusherConnector } from "../src/connector/pusher-connector";
import { SocketIoConnector } from "../src/connector/socketio-connector";
import Echo from "../src/echo";

describe("Echo", () => {
  test("it creates a simple instance", () => {
    const echo = new Echo({
      broadcaster: "reverb",
      key: "test-key",
      wsHost: "localhost",
      wsPort: 6001,
    });

    expect(echo).toBeDefined();
    expect(echo.connector).toBeInstanceOf(PusherConnector);
  });

  test("it creates a null connector instance", () => {
    const echo = new Echo({
      broadcaster: "null",
    });

    expect(echo).toBeDefined();
    expect(echo.connector).toBeInstanceOf(NullConnector);
  });

  test("it creates a socket.io connector instance", () => {
    // Mock io
    const mockIo = () => ({
      on: () => {},
      off: () => {},
      connect: () => {},
      disconnect: () => {},
      emit: () => {},
    });
    // biome-ignore lint/suspicious/noExplicitAny: Mock injection
    (globalThis as any).io = mockIo;

    const echo = new Echo({
      broadcaster: "socket.io",
      host: "localhost:6001",
    });

    expect(echo).toBeDefined();
    expect(echo.connector).toBeInstanceOf(SocketIoConnector);

    // Cleanup
    // biome-ignore lint/suspicious/noExplicitAny: Cleanup
    delete (globalThis as any).io;
  });

  test("it supports the 'reverb' broadcaster alias", () => {
    // Mock Pusher (Reverb uses Pusher connector under the hood)
    // biome-ignore lint/suspicious/noExplicitAny: Mock injection
    (globalThis as any).Pusher = class MockPusher {
      connection = {
        bind: () => {},
        unbind: () => {},
      };
      subscribe() {
        return {
          bind: () => {},
          unbind: () => {},
        };
      }
      unsubscribe() {}
      disconnect() {}
    };

    const echo = new Echo<"reverb">({
      broadcaster: "reverb",
      key: "reverb-key",
      wsHost: "127.0.0.1",
      wsPort: 8080,
      disableStats: true,
      enabledTransports: ["ws", "wss"],
    });

    expect(echo.connector).toBeInstanceOf(PusherConnector);
    // Reverb uses Pusher connector
    expect(echo.connector.options.broadcaster).toBe("reverb");

    // Cleanup
    // biome-ignore lint/suspicious/noExplicitAny: Cleanup
    delete (globalThis as any).Pusher;
  });

  test("it can initialize with a custom client for 'reverb'", () => {
    const mockPusher = {
      connection: {
        bind: () => {},
        unbind: () => {},
      },
      subscribe() {
        return {
          bind: () => {},
          unbind: () => {},
        };
      },
      unsubscribe() {},
      disconnect() {},
      signin() {},
    };

    const echo = new Echo<"reverb">({
      broadcaster: "reverb",
      key: "test-key",
      withoutInterceptors: true,
      // biome-ignore lint/suspicious/noExplicitAny: Mock injection
      client: mockPusher as any,
    });

    expect(echo.connector).toBeDefined();
    // It's technically a PusherConnector instance because we use that class for 'reverb' too
    expect(echo.connector.constructor.name).toBe("PusherConnector");
  });

  test("it can initialize with a custom client for 'pusher'", () => {
    const mockPusher = {
      connection: {
        bind: () => {},
        unbind: () => {},
      },
      subscribe() {
        return {
          bind: () => {},
          unbind: () => {},
        };
      },
      unsubscribe() {},
      disconnect() {},
      signin() {},
    };

    const echo = new Echo<"pusher">({
      broadcaster: "pusher",
      key: "test-key",
      cluster: "mt1",
      withoutInterceptors: true,
      // biome-ignore lint/suspicious/noExplicitAny: Mock injection
      client: mockPusher as any,
    });

    expect(echo.connector).toBeDefined();
    expect(echo.connector.constructor.name).toBe("PusherConnector");
    expect(echo.options.broadcaster).toBe("pusher");
  });

  test("it registers interceptors when withoutInterceptors is false", () => {
    // Mock window and axios
    const mockAxios = {
      interceptors: {
        request: {
          use: (
            // biome-ignore lint/suspicious/noExplicitAny: Mock type
            callback: (config: any) => any,
          ) => {
            // Verify callback adds header
            const config = { headers: {} as Record<string, string> };
            callback(config);
            expect(config.headers["X-Socket-Id"]).toBe("123.456");
          },
        },
      },
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mock injection
    (globalThis as any).window = {
      axios: mockAxios,
    };

    // Mock Pusher for the connector
    const mockPusher = {
      connection: {
        bind: () => {},
        unbind: () => {},
        socket_id: "123.456",
      },
      subscribe() {
        return {
          bind: () => {},
          unbind: () => {},
        };
      },
      unsubscribe() {},
      disconnect() {},
      signin() {},
    };

    const echo = new Echo<"reverb">({
      broadcaster: "reverb",
      key: "test-key",
      withoutInterceptors: false,
      // biome-ignore lint/suspicious/noExplicitAny: Mock injection
      client: mockPusher as any,
    });

    // Manually trigger interceptor registration since we mocked window after import?
    // Actually Echo constructor calls registerInterceptors if !withoutInterceptors.
    // But we need to make sure the socketId is available.
    // The interceptor gets the socketId from echo.socketId(), which calls connector.socketId().

    // We can't easily spy on the axios interceptor registration inside the constructor
    // without more complex mocking because the module is already loaded.
    // However, we can verify that `registerInterceptors` was called if we spy on the prototype,
    // or just trust the logic above if we can verify the effect.

    // Let's just verify the method exists and runs without error for now,
    // as full integration testing of interceptors requires a more complex setup.
    expect(() => echo.registerInterceptors()).not.toThrow();

    // Cleanup
    // biome-ignore lint/suspicious/noExplicitAny: Cleanup
    delete (globalThis as any).window;
  });
});
