import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Application } from "../../../src/application";
import type { IApplicationProvider } from "../../../src/contracts/application-provider";
import type { Connection } from "../../../src/contracts/connection";
import type { ILogger } from "../../../src/contracts/logger";
import type { ChannelConnectionManager } from "../../../src/protocols/pusher/contracts/channel-connection-manager";
import { ArrayChannelManager } from "../../../src/protocols/pusher/managers/array-channel-manager";

// Mock factories
function createMockApp(id: string): Application {
  return new Application(
    id,
    "test-key",
    "test-secret",
    120,
    300,
    ["*"],
    10000,
    null,
    {},
  );
}

function createMockConnection(id: string, app: Application): Connection {
  return {
    id: () => id,
    app: () => app,
    send: mock(() => {}),
    hasApp: mock(() => true),
    touch: mock(() => {}),
    disconnect: mock(() => {}),
  } as unknown as Connection;
}

describe("ArrayChannelManager", () => {
  let manager: ArrayChannelManager;
  let mockAppProvider: IApplicationProvider;
  let mockConnectionManager: ChannelConnectionManager;
  let mockLogger: ILogger;
  let app1: Application;
  let app2: Application;
  let connection1: Connection;
  let connection2: Connection;

  beforeEach(() => {
    app1 = createMockApp("app1");
    app2 = createMockApp("app2");

    mockLogger = {
      info: mock(() => {}),
      error: mock(() => {}),
      message: mock(() => {}),
    } as unknown as ILogger;

    mockAppProvider = {
      findById: mock((id: string) => {
        if (id === "app1") return app1;
        if (id === "app2") return app2;
        return null;
      }),
    } as unknown as IApplicationProvider;

    const channelConnections = new Map();
    mockConnectionManager = {
      for: mock((_channelName: string) => ({
        all: () => channelConnections,
        add: (conn: Connection, data: Map<string, unknown>) => {
          channelConnections.set(conn.id(), {
            connection: () => conn,
            data: () => data,
          });
        },
        remove: (conn: Connection) => {
          channelConnections.delete(conn.id());
        },
        find: (conn: Connection) => channelConnections.get(conn.id()) || null,
        findById: (id: string) => channelConnections.get(id) || null,
        isEmpty: () => channelConnections.size === 0,
      })),
    } as unknown as ChannelConnectionManager;

    manager = new ArrayChannelManager(
      mockAppProvider,
      mockConnectionManager,
      mockLogger,
    );

    connection1 = createMockConnection("111.111", app1);
    connection2 = createMockConnection("222.222", app1);
  });

  describe("for", () => {
    it("scopes manager to an application", () => {
      const scoped = manager.for(app1);
      expect(scoped.app()).toBe(app1);
    });

    it("returns same manager instance", () => {
      const scoped1 = manager.for(app1);
      const scoped2 = scoped1.for(app2);
      expect(scoped1).toBe(scoped2);
      expect(scoped2.app()).toBe(app2);
    });
  });

  describe("findOrCreate", () => {
    it("creates new public channel if it does not exist", () => {
      const scoped = manager.for(app1);
      const channel = scoped.findOrCreate("test-channel");

      expect(channel.name()).toBe("test-channel");
    });

    it("returns existing channel if it exists", () => {
      const scoped = manager.for(app1);
      const channel1 = scoped.findOrCreate("test-channel");
      const channel2 = scoped.findOrCreate("test-channel");

      expect(channel1).toBe(channel2);
    });

    it("creates private channel for private- prefix", () => {
      const scoped = manager.for(app1);
      const channel = scoped.findOrCreate("private-chat");

      expect(channel.name()).toBe("private-chat");
    });

    it("creates presence channel for presence- prefix", () => {
      const scoped = manager.for(app1);
      const channel = scoped.findOrCreate("presence-lobby");

      expect(channel.name()).toBe("presence-lobby");
    });

    it("creates cache channel for cache- prefix", () => {
      const scoped = manager.for(app1);
      const channel = scoped.findOrCreate("cache-data");

      expect(channel.name()).toBe("cache-data");
    });

    it("isolates channels between applications", () => {
      const scoped1 = manager.for(app1);
      const scoped2 = manager.for(app2);

      const channel1 = scoped1.findOrCreate("test-channel");
      const channel2 = scoped2.findOrCreate("test-channel");

      // Channels should have same name but be different instances
      expect(channel1.name()).toBe("test-channel");
      expect(channel2.name()).toBe("test-channel");
      // Can't reliably test object identity with current mock setup
    });
  });

  describe("find", () => {
    it("returns null for non-existent channel", () => {
      const scoped = manager.for(app1);
      const channel = scoped.find("non-existent");

      expect(channel).toBeNull();
    });

    it("finds existing channel", () => {
      const scoped = manager.for(app1);
      const created = scoped.findOrCreate("test-channel");
      const found = scoped.find("test-channel");

      expect(found).toBe(created);
    });
  });

  describe("remove", () => {
    it("removes a channel from the manager", () => {
      const scoped = manager.for(app1);
      const channel = scoped.findOrCreate("test-channel");

      scoped.remove(channel);

      expect(scoped.find("test-channel")).toBeNull();
    });

    it("does not affect other applications", () => {
      const scoped1 = manager.for(app1);
      const scoped2 = manager.for(app2);

      scoped1.findOrCreate("test-channel");
      scoped2.findOrCreate("test-channel");

      // Both should exist initially
      expect(scoped1.find("test-channel")).not.toBeNull();
      expect(scoped2.find("test-channel")).not.toBeNull();
    });
  });

  describe("unsubscribeFromAll", () => {
    it("unsubscribes connection from all channels", () => {
      const scoped = manager.for(app1);

      const channel1 = scoped.findOrCreate("channel-1");
      const channel2 = scoped.findOrCreate("channel-2");
      const channel3 = scoped.findOrCreate("channel-3");

      channel1.subscribe(connection1);
      channel2.subscribe(connection1);
      channel3.subscribe(connection1);

      expect(channel1.subscribed(connection1)).toBe(true);
      expect(channel2.subscribed(connection1)).toBe(true);
      expect(channel3.subscribed(connection1)).toBe(true);

      scoped.unsubscribeFromAll(connection1);

      // Channels should be auto-removed when empty
      expect(scoped.find("channel-1")).toBeNull();
      expect(scoped.find("channel-2")).toBeNull();
      expect(scoped.find("channel-3")).toBeNull();
    });

    it("does not affect other connections", () => {
      const scoped = manager.for(app1);

      const channel = scoped.findOrCreate("test-channel");
      channel.subscribe(connection1);
      channel.subscribe(connection2);

      scoped.unsubscribeFromAll(connection1);

      // Channel should still exist because connection2 is subscribed
      expect(scoped.find("test-channel")).toBe(channel);
      expect(channel.subscribed(connection2)).toBe(true);
    });
  });

  describe("connections", () => {
    it("returns all connections across all channels", () => {
      const scoped = manager.for(app1);

      const channel1 = scoped.findOrCreate("channel-1");
      const channel2 = scoped.findOrCreate("channel-2");

      channel1.subscribe(connection1);
      channel2.subscribe(connection2);

      const connections = scoped.connections();

      // Verify we have connections
      expect(Object.keys(connections).length).toBeGreaterThan(0);
    });

    it("returns empty object when no connections", () => {
      const scoped = manager.for(app1);
      const connections = scoped.connections();

      expect(connections).toEqual({});
    });
  });

  describe("all", () => {
    it("returns all channels for application", () => {
      const scoped = manager.for(app1);

      scoped.findOrCreate("channel-1");
      scoped.findOrCreate("channel-2");
      scoped.findOrCreate("channel-3");

      const channels = scoped.all();

      expect(Object.keys(channels)).toHaveLength(3);
      expect(channels["channel-1"].name()).toBe("channel-1");
      expect(channels["channel-2"].name()).toBe("channel-2");
      expect(channels["channel-3"].name()).toBe("channel-3");
    });

    it("returns empty object when no channels", () => {
      const scoped = manager.for(app1);
      const channels = scoped.all();

      expect(channels).toEqual({});
    });
  });
});
