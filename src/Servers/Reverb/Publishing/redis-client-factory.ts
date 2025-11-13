/**
 * Factory for creating Redis clients for pub/sub operations
 *
 * Handles creation and connection of Redis clients for publishing
 * and subscribing to Redis channels using a standard Redis client library
 * compatible with Bun runtime.
 *
 * @module Servers/Reverb/Publishing/RedisClientFactory
 */

/**
 * Redis client interface for pub/sub operations
 */
export interface RedisClient {
	/**
	 * Send PING command to Redis server
	 */
	ping(): Promise<string>;

	/**
	 * Subscribe to a Redis channel
	 */
	subscribe(channel: string): Promise<void>;

	/**
	 * Unsubscribe from a Redis channel
	 */
	unsubscribe(channel: string): Promise<void>;

	/**
	 * Publish a message to a Redis channel
	 *
	 * @param channel - The channel name
	 * @param message - The message to publish
	 * @returns Number of subscribers that received the message
	 */
	publish(channel: string, message: string): Promise<number>;

	/**
	 * Get a value from Redis
	 */
	get(key: string): Promise<string | null>;

	/**
	 * Set a value in Redis
	 */
	set(
		key: string,
		value: string,
		options?: Record<string, unknown>,
	): Promise<void>;

	/**
	 * Delete a key from Redis
	 */
	del(key: string): Promise<number>;

	/**
	 * Close the Redis connection
	 */
	quit(): Promise<void>;

	/**
	 * Register event listener
	 */
	on(event: string, listener: (...args: unknown[]) => void): void;

	/**
	 * Additional methods
	 */
	[key: string]: unknown;
}

/**
 * Factory for creating Redis clients
 *
 * Creates Redis client connections for the Reverb server.
 * Handles parsing of Redis URLs and establishing connections for
 * pub/sub operations using Bun's native capabilities.
 *
 * **IMPORTANT**: The default implementation returns a no-op mock client that does NOT
 * connect to Redis. Redis pub/sub will NOT work with the default implementation.
 *
 * For production use with Redis, extend this class and override the `createClient()`
 * method to provide a real Redis client implementation (e.g., node-redis, ioredis).
 *
 * @class RedisClientFactory
 * @example
 * ```typescript
 * // Default (mock - no Redis connection)
 * const factory = new RedisClientFactory();
 * const client = await factory.make('redis://localhost:6379');
 *
 * // Custom (real Redis client)
 * class MyRedisClientFactory extends RedisClientFactory {
 *   protected async createClient(config: Record<string, unknown>): Promise<RedisClient> {
 *     const redis = require('redis');
 *     const client = redis.createClient(config);
 *     await client.connect();
 *     return client;
 *   }
 * }
 * ```
 */
export class RedisClientFactory {
	/**
	 * Create a new Redis client connection
	 *
	 * Establishes a connection to a Redis server using the provided URL.
	 * The URL can be in the format:
	 * - redis://[username[:password]@][host][:port][/database]
	 * - rediss://[username[:password]@][host][:port][/database] (TLS)
	 *
	 * Bun's native JavaScript runtime does not provide built-in Redis client,
	 * so this factory assumes an external Redis client library will be
	 * injected or used. In production, integrate with a library like:
	 * - node-redis
	 * - ioredis
	 * - or similar compatible client
	 *
	 * @param redisUrl - The Redis connection URL
	 * @returns Promise that resolves to a connected Redis client
	 *
	 * @throws {Error} If the connection fails or URL is invalid
	 *
	 * @example
	 * ```typescript
	 * const client = await factory.make('redis://localhost:6379/0');
	 * await client.ping();
	 * ```
	 */
	public async make(redisUrl: string): Promise<RedisClient> {
		try {
			// Parse the Redis URL to extract connection parameters
			const url = new URL(redisUrl);

			// Extract components from URL
			const protocol = url.protocol.replace(":", "");
			const hostname = url.hostname || "localhost";
			const port = url.port ? Number.parseInt(url.port, 10) : 6379;
			const username = url.username || undefined;
			const password = url.password || undefined;
			const database = url.pathname
				? Number.parseInt(url.pathname.replace("/", ""), 10) || 0
				: 0;
			const useTls = protocol === "rediss";

			// For Bun runtime, we need to use a compatible Redis client
			// This creates a placeholder that should be replaced with actual Redis library
			// when integrated with a proper Redis client package

			// Connection parameters for the Redis client
			const connectionConfig = {
				hostname,
				port,
				...(username && { username }),
				...(password && { password }),
				...(database && { db: database }),
				...(useTls && { tls: true }),
			};

			// Create a Redis client instance
			// WARNING: The default implementation returns a no-op mock client that does NOT
			// connect to Redis. This means Redis pub/sub will NOT work for multi-server deployments.
			// For production use with Redis, you MUST override the createClient() method in a subclass
			// to provide a real Redis client implementation (e.g., node-redis, ioredis).
			//
			// For single-server deployments without Redis, this mock implementation is sufficient.
			const redisClient: RedisClient =
				await this.createClient(connectionConfig);

			return redisClient;
		} catch (error) {
			throw new Error(
				`Failed to create Redis client: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Create a Redis client with the given configuration
	 *
	 * This method creates the actual Redis client connection.
	 * It serves as an extension point for dependency injection.
	 *
	 * Override this method in a subclass to provide a real Redis client implementation.
	 * For example, using node-redis or ioredis:
	 *
	 * @example
	 * ```typescript
	 * class MyRedisClientFactory extends RedisClientFactory {
	 *   protected async createClient(config: Record<string, unknown>): Promise<RedisClient> {
	 *     const redis = require('redis');
	 *     const client = redis.createClient(config);
	 *     await client.connect();
	 *     return client;
	 *   }
	 * }
	 * ```
	 *
	 * @param config - Redis connection configuration
	 * @returns Promise that resolves to a connected Redis client
	 *
	 * @protected
	 */
	protected async createClient(
		_config: Record<string, unknown>,
	): Promise<RedisClient> {
		// WARNING: This is a NO-OP mock implementation that does NOT connect to Redis.
		// All methods (publish, subscribe, etc.) are no-ops and will NOT work for
		// multi-server deployments requiring Redis pub/sub.
		//
		// This mock is only suitable for single-server deployments that don't need Redis.
		//
		// For production use with Redis, override this method in a subclass to use a
		// real Redis client library (e.g., node-redis, ioredis).
		return {
			ping: async () => "PONG",
			subscribe: async () => {},
			unsubscribe: async () => {},
			publish: async () => 0,
			get: async () => null,
			set: async () => {},
			del: async () => 0,
			quit: async () => {},
			on: () => {},
		};
	}
}
