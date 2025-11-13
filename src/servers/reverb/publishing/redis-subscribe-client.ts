import { RedisClient } from "./redis-client";

/**
 * RedisSubscribeClient
 *
 * Extends RedisClient to handle subscription to Redis channels.
 * Used for subscribing to Redis pub/sub channels.
 *
 * Key Responsibilities:
 * - Subscribe to a specific Redis channel
 * - Override the connection name to 'subscriber'
 */
export class RedisSubscribeClient extends RedisClient {
	/**
	 * The name of the Redis connection.
	 */
	protected override name = "subscriber";

	/**
	 * Subscribe to the given Redis channel.
	 */
	subscribe(): void {
		if (!this.client) {
			throw new Error("Redis client not connected");
		}
		this.client.subscribe(this.channel);
	}
}
