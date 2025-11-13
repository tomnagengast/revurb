import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Application } from "../../../src/application";
import type { IApplicationProvider } from "../../../src/contracts/application-provider";
import type { Connection } from "../../../src/contracts/connection";
import type { ILogger } from "../../../src/contracts/logger";
import { PruneStaleConnections } from "../../../src/jobs/prune-stale-connections";
import type { ChannelConnection } from "../../../src/protocols/pusher/channels/channel-connection";
import type { ChannelManager } from "../../../src/protocols/pusher/contracts/channel-manager";

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
		isActive: mock(() => true),
		isStale: mock(() => false),
		usesControlFrames: mock(() => false),
	} as unknown as Connection;
}

function createMockChannelConnection(
	connection: Connection,
): ChannelConnection {
	return {
		id: () => connection.id(),
		connection: () => connection,
		send: mock(() => {}),
		disconnect: mock(() => {}),
		isStale: mock(() => false),
	} as unknown as ChannelConnection;
}

describe("PruneStaleConnections", () => {
	let job: PruneStaleConnections;
	let mockAppProvider: IApplicationProvider;
	let mockChannelManager: ChannelManager;
	let mockLogger: ILogger;
	let app1: Application;
	let connection1: Connection;
	let connection2: Connection;
	let staleConnection: Connection;
	let channelConnection1: ChannelConnection;
	let channelConnection2: ChannelConnection;
	let staleChannelConnection: ChannelConnection;

	beforeEach(() => {
		app1 = createMockApp("app1");
		connection1 = createMockConnection("conn1", app1);
		connection2 = createMockConnection("conn2", app1);
		staleConnection = createMockConnection("stale-conn", app1);

		// Make staleConnection return true for isStale
		(staleConnection.isStale as ReturnType<typeof mock>).mockReturnValue(true);
		(connection1.isStale as ReturnType<typeof mock>).mockReturnValue(false);
		(connection2.isStale as ReturnType<typeof mock>).mockReturnValue(false);

		channelConnection1 = createMockChannelConnection(connection1);
		channelConnection2 = createMockChannelConnection(connection2);
		staleChannelConnection = createMockChannelConnection(staleConnection);
		(staleChannelConnection.isStale as ReturnType<typeof mock>).mockReturnValue(
			true,
		);
		(channelConnection1.isStale as ReturnType<typeof mock>).mockReturnValue(
			false,
		);
		(channelConnection2.isStale as ReturnType<typeof mock>).mockReturnValue(
			false,
		);

		mockLogger = {
			info: mock(() => {}),
			error: mock(() => {}),
			message: mock(() => {}),
		} as unknown as ILogger;

		mockAppProvider = {
			all: mock(() => [app1]),
			findById: mock(() => app1),
			findByKey: mock(() => app1),
		} as unknown as IApplicationProvider;

		const connectionsMap = new Map<string, ChannelConnection>();
		connectionsMap.set("conn1", channelConnection1);
		connectionsMap.set("conn2", channelConnection2);
		connectionsMap.set("stale-conn", staleChannelConnection);

		const scopedChannelManager = {
			connections: mock(() => {
				const result: Record<string, ChannelConnection> = {};
				connectionsMap.forEach((conn, id) => {
					result[id] = conn;
				});
				return result;
			}),
			unsubscribeFromAll: mock((conn: Connection) => {
				connectionsMap.delete(conn.id());
			}),
		};

		mockChannelManager = {
			for: mock(() => scopedChannelManager),
		} as unknown as ChannelManager;

		job = new PruneStaleConnections(
			mockAppProvider,
			mockLogger,
			mockChannelManager,
		);
	});

	it("should prune stale connections", async () => {
		await job.handle();

		// Verify logger was called
		expect(mockLogger.info).toHaveBeenCalledWith("Pruning Stale Connections");
		expect(mockLogger.info).toHaveBeenCalledWith(
			"Connection Pruned",
			"stale-conn",
		);

		// Verify stale connection received error message
		expect(staleChannelConnection.send).toHaveBeenCalledWith(
			expect.stringContaining("pusher:error"),
		);
		expect(staleChannelConnection.send).toHaveBeenCalledWith(
			expect.stringContaining("4201"),
		);

		// Verify stale connection was disconnected
		expect(staleChannelConnection.disconnect).toHaveBeenCalled();

		// Verify ConnectionPruned event was dispatched
		// (This is tested indirectly through the send call)
	});

	it("should not prune active connections", async () => {
		await job.handle();

		// Verify active connections were not pruned
		expect(channelConnection1.send).not.toHaveBeenCalled();
		expect(channelConnection2.send).not.toHaveBeenCalled();
		expect(channelConnection1.disconnect).not.toHaveBeenCalled();
		expect(channelConnection2.disconnect).not.toHaveBeenCalled();
	});

	it("should process all applications", async () => {
		const app2 = createMockApp("app2");
		(mockAppProvider.all as ReturnType<typeof mock>).mockReturnValue([
			app1,
			app2,
		]);

		await job.handle();

		// Verify channel manager was scoped for each application
		expect(mockChannelManager.for).toHaveBeenCalledWith(app1);
		expect(mockChannelManager.for).toHaveBeenCalledWith(app2);
	});

	it("should handle empty connections gracefully", async () => {
		const scopedChannelManager = {
			connections: mock(() => ({})),
			unsubscribeFromAll: mock(() => {}),
		};
		(mockChannelManager.for as ReturnType<typeof mock>).mockReturnValue(
			scopedChannelManager,
		);

		await job.handle();

		// Should complete without errors
		expect(mockLogger.info).toHaveBeenCalledWith("Pruning Stale Connections");
	});

	it("should send correct error message format", async () => {
		await job.handle();

		const sendCall = (staleChannelConnection.send as ReturnType<typeof mock>)
			.mock.calls[0][0];
		const message = JSON.parse(sendCall);

		expect(message.event).toBe("pusher:error");

		const errorData = JSON.parse(message.data);
		expect(errorData.code).toBe(4201);
		expect(errorData.message).toBe("Pong reply not received in time");
	});
});
