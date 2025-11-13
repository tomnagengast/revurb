/**
 * Exception thrown when a Redis connection fails.
 */
export class RedisConnectionException extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RedisConnectionException";
		Object.setPrototypeOf(this, RedisConnectionException.prototype);
	}

	/**
	 * Create an exception for a timeout while attempting to connect to Redis.
	 */
	static failedAfter(name: string, timeout: number): RedisConnectionException {
		return new RedisConnectionException(
			`Failed to connect to Redis connection [${name}] after retrying for ${timeout}s.`,
		);
	}
}
