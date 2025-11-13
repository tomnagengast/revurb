import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "bun";
import type { ReverbConfig } from "../../src/config/types";
import { Factory } from "../../src/servers/reverb/factory";

describe("WebSocket Connection E2E Tests", () => {
	let server: Server;
	const testPort = 8083;
	const testAppKey = "test-key-e2e";
	const testAppSecret = "test-secret-e2e";
	const testAppId = "test-id-e2e";

	beforeAll(async () => {
		// Create test configuration
		const config: ReverbConfig = {
			server: {
				host: "127.0.0.1",
				port: testPort,
				path: "",
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

		// Initialize factory with test config
		Factory.initialize(config);

		const host = config.server?.host || "127.0.0.1";
		const port = config.server?.port?.toString() || testPort.toString();
		const path = config.server?.path || "";
		const hostname = config.server?.hostname;
		const maxRequestSize = config.server?.max_request_size || 10000;
		const options = {
			tls: config.server?.options?.tls || {},
		};
		const protocol = "pusher";

		server = Factory.make(
			host,
			port,
			path,
			hostname,
			maxRequestSize,
			options,
			protocol,
		);

		// Give server a moment to start
		await new Promise((resolve) => setTimeout(resolve, 100));
	});

	afterAll(() => {
		if (server) {
			server.stop();
		}
	});

	it("should accept WebSocket connection", async () => {
		const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);

		const connected = await new Promise<boolean>((resolve, reject) => {
			const timeout = setTimeout(() => {
				ws.close();
				reject(new Error("Connection timeout"));
			}, 5000);

			ws.onopen = () => {
				clearTimeout(timeout);
				resolve(true);
			};

			ws.onerror = (error) => {
				clearTimeout(timeout);
				reject(error);
			};
		});

		expect(connected).toBe(true);
		ws.close();
	});

	it("should receive connection_established message", async () => {
		const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);

		const message = await new Promise<any>((resolve, reject) => {
			const timeout = setTimeout(() => {
				ws.close();
				reject(new Error("Message timeout"));
			}, 5000);

			ws.onmessage = (event) => {
				clearTimeout(timeout);
				try {
					const data = JSON.parse(event.data);
					resolve(data);
				} catch (e) {
					reject(e);
				}
			};

			ws.onerror = (error) => {
				clearTimeout(timeout);
				reject(error);
			};
		});

		expect(message.event).toBe("pusher:connection_established");
		expect(message.data).toBeDefined();

		const data = JSON.parse(message.data);
		expect(data.socket_id).toBeDefined();
		expect(data.activity_timeout).toBeDefined();

		ws.close();
	});

	it("should reject connection with invalid app key", async () => {
		const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/invalid-key`);

		const errorReceived = await new Promise<boolean>((resolve) => {
			const timeout = setTimeout(() => {
				resolve(false);
			}, 5000);

			ws.onclose = () => {
				clearTimeout(timeout);
				resolve(true);
			};

			ws.onerror = () => {
				clearTimeout(timeout);
				resolve(true);
			};

			ws.onopen = () => {
				clearTimeout(timeout);
				// If connection opens, this is wrong - should have been rejected
				ws.close();
				resolve(false);
			};
		});

		expect(errorReceived).toBe(true);
	});

	it("should handle ping/pong", async () => {
		const ws = new WebSocket(`ws://127.0.0.1:${testPort}/app/${testAppKey}`);

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				ws.close();
				reject(new Error("Connection timeout"));
			}, 5000);

			ws.onopen = () => {
				clearTimeout(timeout);
				resolve();
			};

			ws.onerror = (error) => {
				clearTimeout(timeout);
				reject(error);
			};
		});

		// Send a ping
		ws.send(
			JSON.stringify({
				event: "pusher:ping",
				data: {},
			}),
		);

		// Wait for pong response
		const pongReceived = await new Promise<boolean>((resolve) => {
			const timeout = setTimeout(() => {
				resolve(false);
			}, 5000);

			ws.onmessage = (event) => {
				clearTimeout(timeout);
				try {
					const data = JSON.parse(event.data);
					if (data.event === "pusher:pong") {
						resolve(true);
					}
				} catch (e) {
					resolve(false);
				}
			};
		});

		expect(pongReceived).toBe(true);
		ws.close();
	});
});
