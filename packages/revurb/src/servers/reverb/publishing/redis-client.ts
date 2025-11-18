import { EventEmitter } from "node:events";
import type { ILogger } from "../../../contracts/logger";
import { RedisConnectionException } from "../../../exceptions/redis-connection-exception";
import type {
  RedisClient as IRedisClient,
  RedisClientFactory,
} from "./redis-client-factory";

/**
 * Redis server configuration
 */
export interface RedisServerConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: number;
  driver?: string;
  scheme?: string;
  timeout?: number;
  url?: string;
}

/**
 * Base Redis client with connection management and auto-reconnection
 *
 * Provides connection establishment, automatic reconnection with exponential backoff,
 * and event emission for connection lifecycle events. This is the base class for
 * Redis publishing and subscribing clients.
 *
 * Key features:
 * - Connection establishment and management
 * - Auto-reconnection with configurable timeout (default 60 seconds)
 * - Retry with 1-second intervals
 * - Connection state tracking
 * - Event emission for close/error events
 * - Redis URL parsing with TLS support (redis:// or rediss://)
 * - Support for username, password, and database selection
 *
 * @example
 * ```typescript
 * const client = new RedisClient(
 *   logger,
 *   new RedisClientFactory(),
 *   'my-channel',
 *   { host: 'localhost', port: 6379 },
 *   (client) => {
 *     console.log('Connected to Redis');
 *   }
 * );
 * await client.connect();
 * ```
 */
export class RedisClient extends EventEmitter {
  /**
   * Redis connection client instance
   */
  protected client: IRedisClient | null = null;

  /**
   * The name of the Redis connection
   */
  protected name = "redis";

  /**
   * Determine if the client should attempt to reconnect when disconnected from the server
   */
  protected shouldRetry = true;

  /**
   * Number of seconds elapsed since attempting to reconnect
   */
  protected retryTimer = 0;

  /**
   * Timer handle for reconnection attempts
   */
  private reconnectTimer: Timer | null = null;

  /**
   * Create a new instance of the Redis client
   *
   * @param logger - Logger instance for connection events
   * @param clientFactory - Factory for creating Redis client connections
   * @param channel - The Redis channel name (for logging/identification)
   * @param server - Redis server configuration
   * @param onConnect - Optional callback invoked when connection is established
   */
  constructor(
    protected logger: ILogger,
    protected clientFactory: RedisClientFactory,
    protected channel: string,
    protected server: RedisServerConfig,
    protected onConnect?: ((client: IRedisClient) => void) | null,
  ) {
    super();
  }

  /**
   * Create a new connection to the Redis server
   */
  public async connect(): Promise<void> {
    try {
      const client = await this.clientFactory.make(this.redisUrl());
      this.onConnection(client);
    } catch (exception) {
      this.onFailedConnection(exception as Error);
    }
  }

  /**
   * Attempt to reconnect to the Redis server
   *
   * Schedules a reconnection attempt after 1 second if retries are enabled
   */
  public reconnect(): void {
    if (!this.shouldRetry) {
      return;
    }

    this.reconnectTimer = setTimeout(() => this.attemptReconnection(), 1000);
  }

  /**
   * Disconnect from the Redis server
   *
   * Disables auto-reconnection and closes the client connection
   */
  public disconnect(): void {
    this.shouldRetry = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.client?.quit();
  }

  /**
   * Listen for a given event from the Redis client
   *
   * @param event - Event name
   * @param callback - Event handler callback
   */
  public override on(
    event: string,
    callback: (...args: unknown[]) => void,
  ): this {
    if (this.client) {
      this.client.on(event, callback);
    }
    return super.on(event, callback);
  }

  /**
   * Determine if the client is currently connected to the server
   *
   * @returns True if connected, false otherwise
   */
  public isConnected(): boolean {
    if (!this.client) {
      return false;
    }
    // Check for ioredis status property
    const status = (this.client as { status?: string }).status;
    return status === "ready" || status === "connect";
  }

  /**
   * Configure error handler for the Redis client
   *
   * Sets up event listeners for connection close events to trigger reconnection.
   * Uses ioredis event names: 'end' for disconnection, 'error' for errors.
   */
  protected configureClientErrorHandler(): void {
    if (!this.client) {
      return;
    }

    // ioredis uses 'end' event for disconnection
    this.client.on("end", () => {
      this.client = null;

      this.logger.info("Disconnected from Redis", `<fg=red>${this.name}</>`);

      this.reconnect();
    });

    // Also handle 'close' for compatibility
    this.client.on("close", () => {
      if (this.client) {
        this.client = null;
        this.logger.info("Disconnected from Redis", `<fg=red>${this.name}</>`);
        this.reconnect();
      }
    });

    this.client.on("error", (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis error: ${message}`);
    });
  }

  /**
   * Handle a successful connection to the Redis server
   *
   * @param client - Connected Redis client instance
   */
  protected onConnection(client: IRedisClient): void {
    this.client = client;

    this.resetRetryTimer();
    this.configureClientErrorHandler();

    if (this.onConnect) {
      this.onConnect(client);
    }

    this.logger.info(
      "Redis connection established",
      `<fg=green>${this.name}</>`,
    );
  }

  /**
   * Handle a failed connection to the Redis server
   *
   * @param exception - Exception that caused the connection failure
   */
  protected onFailedConnection(exception: Error): void {
    this.client = null;

    this.logger.error(exception.message);

    this.reconnect();
  }

  /**
   * Attempt to reconnect to the Redis server until the timeout is reached
   *
   * Increments the retry timer and throws an exception if the timeout is exceeded
   */
  protected attemptReconnection(): void {
    this.retryTimer++;

    if (this.retryTimer >= this.retryTimeout()) {
      const exception = RedisConnectionException.failedAfter(
        this.name,
        this.retryTimeout(),
      );

      this.logger.error(exception.message);

      throw exception;
    }

    this.logger.info(
      "Attempting reconnection to Redis",
      `<fg=yellow>${this.name}</>`,
    );

    this.connect();
  }

  /**
   * Determine the configured reconnection timeout
   *
   * @returns Timeout in seconds (default 60)
   */
  protected retryTimeout(): number {
    return this.server.timeout ?? 60;
  }

  /**
   * Reset the retry connection timer
   */
  protected resetRetryTimer(): void {
    this.retryTimer = 0;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Get the connection URL for Redis
   *
   * Parses the server configuration and builds a Redis connection URL
   * with support for TLS, authentication, and database selection.
   *
   * @returns Redis connection URL (redis:// or rediss:// for TLS)
   */
  protected redisUrl(): string {
    const config = this.server;

    // If URL is provided directly, use it
    if (config.url) {
      return config.url;
    }

    // Parse configuration
    const driver =
      config.driver?.toLowerCase() || config.scheme?.toLowerCase() || "";
    const scheme = driver === "tls" || driver === "rediss" ? "rediss" : "redis";
    const host = config.host || "localhost";
    const port = config.port || 6379;

    // Build query parameters
    const queryParams: string[] = [];

    if (config.username) {
      queryParams.push(`username=${encodeURIComponent(config.username)}`);
    }

    if (config.password) {
      queryParams.push(`password=${encodeURIComponent(config.password)}`);
    }

    if (config.database !== undefined) {
      queryParams.push(`db=${config.database}`);
    }

    const query = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

    return `${scheme}://${host}:${port}${query}`;
  }
}
