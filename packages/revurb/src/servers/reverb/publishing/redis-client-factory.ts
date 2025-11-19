/**
 * Factory for creating Redis clients for pub/sub operations
 *
 * Handles creation and connection of Redis clients for publishing
 * and subscribing to Redis channels using ioredis, a Redis client
 * compatible with Bun runtime.
 *
 * @module Servers/Reverb/Publishing/RedisClientFactory
 */

import IORedis, { type RedisOptions } from "ioredis";

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
 * Creates Redis client connections for the Reverb server using ioredis.
 * Handles parsing of Redis URLs and establishing connections for
 * pub/sub operations.
 *
 * @class RedisClientFactory
 * @example
 * ```typescript
 * const factory = new RedisClientFactory();
 * const client = await factory.make('redis://localhost:6379');
 * await client.ping();
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

      // Parse query parameters for additional options
      const params = new URLSearchParams(url.search);

      // Extract components from URL and query parameters
      // Query parameters take precedence over URL components for username, password, and db
      const protocol = url.protocol.replace(":", "");
      const host = url.hostname || "localhost";
      const port = url.port ? Number.parseInt(url.port, 10) : 6379;
      const username = params.get("username") || url.username || undefined;
      const password = params.get("password") || url.password || undefined;
      const db = params.get("db")
        ? Number.parseInt(params.get("db") as string, 10)
        : url.pathname
          ? Number.parseInt(url.pathname.replace("/", ""), 10) || 0
          : 0;
      const timeout = params.get("timeout")
        ? Number.parseInt(params.get("timeout") as string, 10)
        : undefined;

      // Build ioredis connection options
      const options: RedisOptions = {
        host,
        port,
        db,
        ...(username && { username }),
        ...(password && { password }),
        ...(timeout && { connectTimeout: timeout }),
        lazyConnect: true, // Don't connect immediately constructor
      };

      // Enable TLS for rediss:// protocol
      if (protocol === "rediss") {
        options.tls = {};
      }

      // Create a Redis client instance using ioredis
      const redisClient = await this.createClient(options);

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
   * This method creates the actual Redis client connection using ioredis.
   * It initiates the connection but does not wait for it to complete,
   * allowing the caller to attach event listeners immediately.
   *
   * @param options - ioredis connection options
   * @returns Promise that resolves to a Redis client instance
   *
   * @protected
   */
  protected async createClient(options: RedisOptions): Promise<RedisClient> {
    // Create client with lazyConnect: true (set in make) or default
    const client = new IORedis(options);

    // Trigger connection if lazyConnect was true
    // We don't await this so we can return the client immediately
    // and let the caller handle events/errors via the returned client
    if (options.lazyConnect) {
      client.connect().catch(() => {
        // Suppress unhandled rejection here, errors will be emitted on the client
      });
    }

    return client as unknown as RedisClient;
  }
}
