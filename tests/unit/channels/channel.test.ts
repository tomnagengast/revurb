import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Application } from "../../../src/application";
import type { Connection } from "../../../src/contracts/connection";
import type { ILogger } from "../../../src/contracts/logger";
import type { ChannelManager } from "../../../src/protocols/pusher/channels/channel";
import { Channel } from "../../../src/protocols/pusher/channels/channel";
import type { ChannelConnection } from "../../../src/protocols/pusher/channels/channel-connection";
import type { ChannelConnectionManager } from "../../../src/protocols/pusher/contracts/channel-connection-manager";

// Mock connection factory
function createMockConnection(id = "123.456"): Connection {
  return {
    id: () => id,
    send: mock(() => {}),
    app: mock(() => ({ id: "test-app" }) as Application),
    hasApp: mock(() => true),
    touch: mock(() => {}),
    disconnect: mock(() => {}),
  } as unknown as Connection;
}

// Mock channel connection factory
function createMockChannelConnection(
  connection: Connection,
  data: any = {},
): ChannelConnection {
  return {
    connection: () => connection,
    data: () => data,
  } as ChannelConnection;
}

describe("Channel", () => {
  let channel: Channel;
  let mockConnectionManager: ChannelConnectionManager;
  let mockChannelManager: ChannelManager;
  let mockLogger: ILogger;
  let connection1: Connection;
  let connection2: Connection;
  let connection3: Connection;

  beforeEach(() => {
    // Create mock connections
    connection1 = createMockConnection("111.111");
    connection2 = createMockConnection("222.222");
    connection3 = createMockConnection("333.333");

    // Create mock logger
    mockLogger = {
      info: mock(() => {}),
      error: mock(() => {}),
      message: mock(() => {}),
    } as unknown as ILogger;

    // Create shared connections map for the channel
    const connections = new Map<string, ChannelConnection>();

    // Create mock connection manager with proper state management
    mockConnectionManager = {
      for: mock((_channelName: string) => mockConnectionManager),
      add: (conn: Connection, data: any) => {
        connections.set(conn.id(), createMockChannelConnection(conn, data));
      },
      remove: (conn: Connection) => {
        connections.delete(conn.id());
      },
      find: (conn: Connection) => {
        return connections.get(conn.id()) || null;
      },
      findById: (id: string) => {
        return connections.get(id) || null;
      },
      all: () => connections,
      isEmpty: () => connections.size === 0,
    } as unknown as ChannelConnectionManager;

    // Create mock channel manager
    mockChannelManager = {
      for: mock(() => mockChannelManager),
      remove: mock(() => {}),
    } as unknown as ChannelManager;

    // Create channel instance
    channel = new Channel(
      "test-channel",
      mockConnectionManager,
      mockChannelManager,
      mockLogger,
    );
  });

  describe("name", () => {
    it("returns the channel name", () => {
      expect(channel.name()).toBe("test-channel");
    });
  });

  describe("subscribe", () => {
    it("can subscribe a connection to a channel", () => {
      channel.subscribe(connection1);

      expect(channel.subscribed(connection1)).toBe(true);
    });

    it("can subscribe with data", () => {
      const data = JSON.stringify({
        user_id: "123",
        user_info: { name: "Alice" },
      });
      channel.subscribe(connection1, null, data);

      expect(channel.subscribed(connection1)).toBe(true);
      const found = channel.find(connection1);
      expect(found).toBe(connection1);
    });

    it("can subscribe multiple connections", () => {
      channel.subscribe(connection1);
      channel.subscribe(connection2);
      channel.subscribe(connection3);

      expect(channel.subscribed(connection1)).toBe(true);
      expect(channel.subscribed(connection2)).toBe(true);
      expect(channel.subscribed(connection3)).toBe(true);
    });
  });

  describe("unsubscribe", () => {
    it("can unsubscribe a connection from a channel", () => {
      channel.subscribe(connection1);
      channel.unsubscribe(connection1);

      expect(channel.subscribed(connection1)).toBe(false);
    });

    it("removes channel when no subscribers remain", () => {
      channel.subscribe(connection1);
      channel.unsubscribe(connection1);

      expect(mockChannelManager.remove).toHaveBeenCalledWith(channel);
    });

    it("does not remove channel when subscribers remain", () => {
      channel.subscribe(connection1);
      channel.subscribe(connection2);
      channel.unsubscribe(connection1);

      expect(mockChannelManager.remove).not.toHaveBeenCalled();
      expect(channel.subscribed(connection2)).toBe(true);
    });
  });

  describe("subscribed", () => {
    it("returns true for subscribed connections", () => {
      channel.subscribe(connection1);

      expect(channel.subscribed(connection1)).toBe(true);
    });

    it("returns false for non-subscribed connections", () => {
      expect(channel.subscribed(connection1)).toBe(false);
    });
  });

  describe("find", () => {
    it("can find a subscribed connection", () => {
      channel.subscribe(connection1);

      const found = channel.find(connection1);
      expect(found).toBe(connection1);
    });

    it("returns null for non-subscribed connection", () => {
      const found = channel.find(connection1);
      expect(found).toBe(null);
    });
  });

  describe("findById", () => {
    it("can find a connection by ID", () => {
      channel.subscribe(connection1);

      const found = channel.findById("111.111");
      expect(found).toBe(connection1);
    });

    it("returns null for non-existent ID", () => {
      const found = channel.findById("999.999");
      expect(found).toBe(null);
    });
  });

  describe("broadcast", () => {
    it("can broadcast to all connections", () => {
      channel.subscribe(connection1);
      channel.subscribe(connection2);
      channel.subscribe(connection3);

      // Verify connections are subscribed
      const connections = channel.connections();
      expect(Object.keys(connections)).toHaveLength(3);

      channel.broadcast({ event: "test", data: { foo: "bar" } });

      expect(connection1.send).toHaveBeenCalledWith(
        JSON.stringify({ event: "test", data: { foo: "bar" } }),
      );
      expect(connection2.send).toHaveBeenCalledWith(
        JSON.stringify({ event: "test", data: { foo: "bar" } }),
      );
      expect(connection3.send).toHaveBeenCalledWith(
        JSON.stringify({ event: "test", data: { foo: "bar" } }),
      );
    });

    it("does not broadcast to excluded connection", () => {
      channel.subscribe(connection1);
      channel.subscribe(connection2);
      channel.subscribe(connection3);

      channel.broadcast({ event: "test", data: { foo: "bar" } }, connection1);

      expect(connection1.send).not.toHaveBeenCalled();
      expect(connection2.send).toHaveBeenCalled();
      expect(connection3.send).toHaveBeenCalled();
    });

    it("logs broadcast operations", () => {
      channel.subscribe(connection1);
      channel.broadcast({ event: "test" });

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Broadcasting To",
        "test-channel",
      );
      expect(mockLogger.message).toHaveBeenCalledWith(
        JSON.stringify({ event: "test" }),
      );
    });
  });

  describe("broadcastToAll", () => {
    it("broadcasts to all connections without exceptions", () => {
      channel.subscribe(connection1);
      channel.subscribe(connection2);

      channel.broadcastToAll({ event: "test", data: "all" });

      expect(connection1.send).toHaveBeenCalledWith(
        JSON.stringify({ event: "test", data: "all" }),
      );
      expect(connection2.send).toHaveBeenCalledWith(
        JSON.stringify({ event: "test", data: "all" }),
      );
    });
  });

  describe("broadcastInternally", () => {
    it("delegates to broadcast method", () => {
      channel.subscribe(connection1);
      channel.subscribe(connection2);

      channel.broadcastInternally({ event: "internal" }, connection1);

      expect(connection1.send).not.toHaveBeenCalled();
      expect(connection2.send).toHaveBeenCalled();
    });
  });

  describe("data", () => {
    it("returns empty object for public channels", () => {
      expect(channel.data()).toEqual({});
    });
  });

  describe("toJSON", () => {
    it("serializes to channel name", () => {
      expect(channel.toJSON()).toEqual({ name: "test-channel" });
    });
  });

  describe("connections", () => {
    it("returns all subscribed connections", () => {
      channel.subscribe(connection1);
      channel.subscribe(connection2);

      const connections = channel.connections();
      expect(Object.keys(connections)).toHaveLength(2);
      expect(connections["111.111"]).toBeDefined();
      expect(connections["222.222"]).toBeDefined();
    });

    it("returns empty object when no connections", () => {
      const connections = channel.connections();
      expect(connections).toEqual({});
    });
  });
});
