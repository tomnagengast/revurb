/**
 * Redis Pub/Sub Provider Implementation
 *
 * Implements the PubSubProvider interface using Redis for distributed event handling.
 * Creates separate publisher and subscriber clients (dual client pattern) to allow
 * simultaneous publishing and subscribing to Redis channels.
 *
 * Key responsibilities:
 * - Manage separate Redis connections for publishing and subscribing
 * - Connect both clients to Redis
 * - Set up message handling and event filtering
 * - Provide filtered event listening via the 'on' method
 * - Publish messages via the publisher client
 * - Handle disconnection properly (subscriber first, then publisher)
 *
 * @module Servers/Reverb/Publishing/RedisPubSubProvider
 */

import type { ILogger } from "../../../contracts/logger";
import type { IPubSubIncomingMessageHandler } from "../contracts/pubsub-incoming-message-handler";
import type { IPubSubProvider } from "../contracts/pubsub-provider";
import type { RedisServerConfig } from "./redis-client";
import { RedisClientFactory } from "./redis-client-factory";
import { RedisPublishClient } from "./redis-publish-client";
import { RedisSubscribeClient } from "./redis-subscribe-client";

/**
 * Redis Pub/Sub Provider
 *
 * Coordinates Redis publisher and subscriber clients to provide a unified
 * interface for pub/sub operations. Implements the PubSubProvider interface.
 */
export class RedisPubSubProvider implements IPubSubProvider {
	/**
	 * The Redis publisher client
	 */
	protected publisher?: RedisPublishClient;

	/**
	 * The Redis subscriber client
	 */
	protected subscriber?: RedisSubscribeClient;

	/**
	 * Create a new Redis Pub/Sub provider instance
	 *
	 * @param logger - Logger instance for connection events
	 * @param messageHandler - Handler for incoming messages
	 * @param channel - Redis channel name
	 * @param server - Redis server configuration
	 * @param clientFactory - Factory for creating Redis clients (defaults to RedisClientFactory instance)
	 */
	constructor(
		protected logger: ILogger,
		protected messageHandler: IPubSubIncomingMessageHandler,
		protected channel: string,
		protected server: RedisServerConfig = {},
		protected clientFactory: RedisClientFactory = new RedisClientFactory(),
	) {}

	/**
	 * Connect to Redis
	 *
	 * Creates and connects both publisher and subscriber clients.
	 * The subscriber is initialized with a callback to set up subscriptions.
	 */
	async connect(): Promise<void> {
		// Create publisher client
		this.publisher = new RedisPublishClient(
			this.logger,
			this.clientFactory,
			this.channel,
			this.server,
		);

		// Create subscriber client with onConnect callback
		this.subscriber = new RedisSubscribeClient(
			this.logger,
			this.clientFactory,
			this.channel,
			this.server,
			() => this.subscribe(),
		);

		// Connect both clients
		await this.publisher.connect();
		await this.subscriber.connect();
	}

	/**
	 * Disconnect from Redis
	 *
	 * Disconnects subscriber first, then publisher to ensure clean shutdown.
	 */
	async disconnect(): Promise<void> {
		this.subscriber?.disconnect();
		this.publisher?.disconnect();
	}

	/**
	 * Subscribe to the Redis channel
	 *
	 * Sets up the subscription and registers a handler for incoming messages.
	 */
	async subscribe(): Promise<void> {
		if (!this.subscriber) {
			throw new Error("Subscriber not initialized");
		}

		this.subscriber.subscribe();

		this.subscriber.on("message", (_channel: string, payload: string) => {
			this.messageHandler.handle(payload);
		});
	}

	/**
	 * Listen for a specific event type
	 *
	 * Filters incoming messages by event type and calls the callback
	 * only when the message type matches the requested event.
	 *
	 * @param event - The event type to listen for
	 * @param callback - Function to call when the event is received
	 */
	on(event: string, callback: (data: any) => void): void {
		if (!this.subscriber) {
			throw new Error("Subscriber not initialized");
		}

		this.subscriber.on("message", (_channel: string, payload: string) => {
			try {
				const parsed = JSON.parse(payload);

				if (parsed.type === event) {
					callback(parsed);
				}
			} catch (error) {
				this.logger.error(`Failed to parse Redis message: ${error}`);
			}
		});
	}

	/**
	 * Publish a message to the Redis channel
	 *
	 * @param payload - The data to publish
	 */
	async publish(payload: Record<string, any>): Promise<void> {
		if (!this.publisher) {
			throw new Error("Publisher not initialized");
		}

		await this.publisher.publish(payload);
	}
}
