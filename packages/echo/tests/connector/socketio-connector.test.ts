import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { SocketIoConnector } from "../../src/connector/socketio-connector";

describe("SocketIoConnector", () => {
  let connector: SocketIoConnector;
  // biome-ignore lint/suspicious/noExplicitAny: Mock socket
  let mockSocket: any;
  // biome-ignore lint/suspicious/noExplicitAny: Mock IO
  let mockIo: any;

  beforeEach(() => {
    mockSocket = {
      id: "mock-socket-id",
      disconnect: mock(),
      emit: mock(),
      on: mock(),
      io: {
        on: mock(),
      },
    };

    mockIo = mock(() => mockSocket);
  });

  test("connects using provided client", () => {
    connector = new SocketIoConnector({
      broadcaster: "socket.io",
      client: mockIo,
    });

    expect(mockIo).toHaveBeenCalled();
    expect(connector.socket).toBe(mockSocket);
    expect(mockSocket.io.on).toHaveBeenCalledWith(
      "reconnect",
      expect.any(Function),
    );
  });

  test("resubscribes to channels on reconnect", () => {
    connector = new SocketIoConnector({
      broadcaster: "socket.io",
      client: mockIo,
    });

    // Get the reconnect callback
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation access
    const calls = (mockSocket.io.on as any).mock.calls;
    const reconnectCallback = calls.find(
      // biome-ignore lint/suspicious/noExplicitAny: Mock call arguments
      (call: any[]) => call[0] === "reconnect",
    )[1];

    expect(reconnectCallback).toBeDefined();

    // Create a channel
    const channel = connector.channel("test-channel");

    const subscribeSpy = spyOn(channel, "subscribe");

    // Trigger reconnect
    reconnectCallback();

    expect(subscribeSpy).toHaveBeenCalled();
  });

  test("disconnects socket", () => {
    connector = new SocketIoConnector({
      broadcaster: "socket.io",
      client: mockIo,
    });

    connector.disconnect();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  test("socketId returns socket id", () => {
    connector = new SocketIoConnector({
      broadcaster: "socket.io",
      client: mockIo,
    });

    expect(connector.socketId()).toBe("mock-socket-id");
  });

  test("leave removes channel from channels list", () => {
    connector = new SocketIoConnector({
      broadcaster: "socket.io",
      client: mockIo,
    });

    connector.channel("test");
    expect(connector.channels.test).toBeDefined();

    connector.leave("test");
    expect(connector.channels.test).toBeUndefined();
  });

  test("leaveChannel removes channel from channels list", () => {
    connector = new SocketIoConnector({
      broadcaster: "socket.io",
      client: mockIo,
    });

    connector.channel("test");
    expect(connector.channels.test).toBeDefined();

    connector.leaveChannel("test");
    expect(connector.channels.test).toBeUndefined();
  });
});
