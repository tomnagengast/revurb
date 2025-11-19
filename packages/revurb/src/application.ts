/**
 * Represents a WebSocket application configuration.
 *
 * This class is an immutable value object that encapsulates all configuration
 * settings for a WebSocket application instance.
 */
export class Application {
  /**
   * Create a new application instance.
   *
   * @param _id - The application ID
   * @param _key - The application key
   * @param _secret - The application secret
   * @param _pingInterval - The client ping interval in seconds
   * @param _activityTimeout - The activity timeout in seconds
   * @param _allowedOrigins - The allowed origins
   * @param _maxMessageSize - The maximum message size allowed from the client
   * @param _maxConnections - The maximum connections allowed for the application
   * @param _options - The application options
   */
  constructor(
    private readonly _id: string,
    private readonly _key: string,
    private readonly _secret: string,
    private readonly _pingInterval: number,
    private readonly _activityTimeout: number,
    private readonly _allowedOrigins: string[],
    private readonly _maxMessageSize: number,
    private readonly _maxConnections: number | null = null,
    private readonly _options: Record<string, unknown> = {},
  ) {}

  /**
   * Get the application ID.
   *
   * @returns The application ID
   */
  id(): string {
    return this._id;
  }

  /**
   * Get the application key.
   *
   * @returns The application key
   */
  key(): string {
    return this._key;
  }

  /**
   * Get the application secret.
   *
   * @returns The application secret
   */
  secret(): string {
    return this._secret;
  }

  /**
   * Get the allowed origins.
   *
   * @returns The allowed origins
   */
  allowedOrigins(): string[] {
    return this._allowedOrigins;
  }

  /**
   * Get the client ping interval in seconds.
   *
   * @returns The ping interval
   */
  pingInterval(): number {
    return this._pingInterval;
  }

  /**
   * Get the activity timeout in seconds.
   *
   * @returns The activity timeout
   */
  activityTimeout(): number {
    return this._activityTimeout;
  }

  /**
   * Get the maximum connections allowed for the application.
   *
   * @returns The maximum connections
   */
  maxConnections(): number | null {
    return this._maxConnections;
  }

  /**
   * Determine if the application has a maximum connection limit.
   *
   * @returns True if the application has a maximum connection limit
   */
  hasMaxConnectionLimit(): boolean {
    return this._maxConnections !== null;
  }

  /**
   * Get the maximum message size allowed from the client.
   *
   * @returns The maximum message size
   */
  maxMessageSize(): number {
    return this._maxMessageSize;
  }

  /**
   * Get the application options.
   *
   * @returns The application options
   */
  options(): Record<string, unknown> {
    return this._options;
  }

  /**
   * Convert the application to an array.
   *
   * @returns Object representation of the application
   */
  toArray(): Record<string, unknown> {
    return {
      app_id: this._id,
      key: this._key,
      secret: this._secret,
      ping_interval: this._pingInterval,
      activity_timeout: this._activityTimeout,
      allowed_origins: this._allowedOrigins,
      max_message_size: this._maxMessageSize,
      options: this._options,
    };
  }
}
