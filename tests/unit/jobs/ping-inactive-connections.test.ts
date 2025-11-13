import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Application } from "../../../src/application";
import type { IApplicationProvider } from "../../../src/contracts/application-provider";
import type { Connection } from "../../../src/contracts/connection";
import type { ILogger } from "../../../src/contracts/logger";
import { PingInactiveConnections } from "../../../src/jobs/ping-inactive-connections";
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

function createMockConnection(
	id: string,
	app: Application,
	isActive = true,
): Connection {
	return {
		id: () => id,
		app: () => app,
		send: mock(() => {}),
		hasApp: mock(() => true),
		touch: mock(() => {}),
		disconnect: mock(() => {}),
		isActive: mock(() => isActive),
		isStale: mock(() => false),
		usesControlFrames: mock(() => false),
		ping: mock(() => {}),
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

describe("PingInactiveConnections", () => {
	let job: PingInactiveConnections;
	let mockAppProvider: IApplicationProvider;
	let mockChannelManager: ChannelManager;
	let mockLogger: ILogger;
	let app1: Application;
	let activeConnection: Connection;
	let inactiveConnection1: Connection;
	let inactiveConnection2: Connection;
	let activeChannelConnection: ChannelConnection;
	let inactiveChannelConnection1: ChannelConnection;
	let inactiveChannelConnection2: ChannelConnection;

	beforeEach(() => {
		app1 = createMockApp("app1");
		activeConnection = createMockConnection("active-conn", app1, true);
		inactiveConnection1 = createMockConnection("inactive-conn1", app1, false);
		inactiveConnection2 = createMockConnection("inactive-conn2", app1, false);

		activeChannelConnection = createMockChannelConnection(activeConnection);
		inactiveChannelConnection1 =
			createMockChannelConnection(inactiveConnection1);
		inactiveChannelConnection2 =
			createMockChannelConnection(inactiveConnection2);

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
		connectionsMap.set("active-conn", activeChannelConnection);
		connectionsMap.set("inactive-conn1", inactiveChannelConnection1);
		connectionsMap.set("inactive-conn2", inactiveChannelConnection2);

		const scopedChannelManager = {
			connections: mock(() => {
				const result: Record<string, ChannelConnection> = {};
				connectionsMap.forEach((conn, id) => {
					result[id] = conn;
				});
				return result;
			}),
		};

		mockChannelManager = {
			for: mock(() => scopedChannelManager),
		} as unknown as ChannelManager;

		job = new PingInactiveConnections(
			mockAppProvider,
			mockLogger,
			mockChannelManager,
		);
	});

	it("should ping inactive connections", async () => {
		await job.handle();

		// Verify logger was called
		expect(mockLogger.info).toHaveBeenCalledWith(
			"Pinging Inactive Connections",
		);
		expect(mockLogger.info).toHaveBeenCalledWith(
			"Connection Pinged",
			"inactive-conn1",
		);
		expect(mockLogger.info).toHaveBeenCalledWith(
			"Connection Pinged",
			"inactive-conn2",
		);

		// Verify ping was sent to inactive connections
		// Note: The ping is sent via EventHandler.ping(), which sends a pusher:ping message
		// We can verify the connection's send was called (EventHandler will call it)
		// However, since EventHandler is instantiated inside handle(), we can't easily mock it
		// So we verify the logger calls instead, which confirms the ping logic ran
	});

	it("should not ping active connections", async () => {
		await job.handle();

		// Verify active connection was not pinged
		// (We verify this indirectly by checking logger calls don't include active-conn)
		const logCalls = (mockLogger.info as ReturnType<typeof mock>).mock.calls;
		const pingedConnections = logCalls
			.filter((call) => call[0] === "Connection Pinged")
			.map((call) => call[1]);

		expect(pingedConnections).not.toContain("active-conn");
		expect(pingedConnections).toContain("inactive-conn1");
		expect(pingedConnections).toContain("inactive-conn2");
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
		};
		(mockChannelManager.for as ReturnType<typeof mock>).mockReturnValue(
			scopedChannelManager,
		);

		await job.handle();

		// Should complete without errors
		expect(mockLogger.info).toHaveBeenCalledWith(
			"Pinging Inactive Connections",
		);
		// Should not log any "Connection Pinged" messages
		const pingCalls = (
			mockLogger.info as ReturnType<typeof mock>
		).mock.calls.filter((call) => call[0] === "Connection Pinged");
		expect(pingCalls).toHaveLength(0);
	});

	it("should handle multiple inactive connections", async () => {
		await job.handle();

		// Verify both inactive connections were pinged
		const logCalls = (mockLogger.info as ReturnType<typeof mock>).mock.calls;
		const pingedConnections = logCalls
			.filter((call) => call[0] === "Connection Pinged")
			.map((call) => call[1]);

		expect(pingedConnections).toHaveLength(2);
		expect(pingedConnections).toContain("inactive-conn1");
		expect(pingedConnections).toContain("inactive-conn2");
	});
});
