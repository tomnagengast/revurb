import type { Connection } from '../../contracts/connection';
import type { ILogger } from '../../contracts/logger';
import type { Frame, FrameOpcode } from '../../contracts/websocket-connection';
import type { PusherMessage } from '../../types/pusher-messages';
import { PusherErrorCode } from '../../types/pusher-messages';
import { ConnectionLimitExceeded } from './exceptions/connection-limit-exceeded';
import { InvalidOrigin } from './exceptions/invalid-origin';
import { PusherException } from './exceptions/pusher-exception';
import type { ChannelManager } from './contracts/channel-manager';
import type { EventHandler } from './event-handler';
import type { ClientEvent } from './client-event';
import { MessageReceived } from '../../events/message-received';

/**
 * Pusher Protocol Server
 *
 * Handles the WebSocket server lifecycle for the Pusher protocol, including:
 * - Connection establishment and authentication
 * - Message routing and validation
 * - Control frame handling (PING/PONG)
 * - Error handling and connection cleanup
 * - Origin verification and connection limits
 *
 * This class serves as the main entry point for Pusher protocol operations,
 * delegating specific functionality to EventHandler and ClientEvent handlers.
 *
 * @example
 * ```typescript
 * const server = new Server(channelManager, eventHandler, clientEvent, logger);
 *
 * // Handle new connection
 * server.open(connection);
 *
 * // Handle incoming message
 * server.message(connection, '{"event":"pusher:subscribe","data":{"channel":"my-channel"}}');
 *
 * // Handle control frame
 * server.control(connection, pingFrame);
 *
 * // Handle connection close
 * server.close(connection);
 * ```
 */
export class Server {
  /**
   * Create a new server instance.
   *
   * @param channels - The channel manager for managing channel subscriptions
   * @param handler - The event handler for Pusher protocol events
   * @param clientEvent - The client event handler for client-to-client messages
   * @param logger - The logger instance for logging server operations
   */
  constructor(
    protected readonly channels: ChannelManager,
    protected readonly handler: EventHandler,
    protected readonly clientEvent: ClientEvent,
    protected readonly logger: ILogger
  ) {}

  /**
   * Handle a client connection.
   *
   * Validates the connection against connection limits and origin restrictions,
   * then sends a connection_established event to the client with the socket ID
   * and activity timeout.
   *
   * If any errors occur during connection establishment, they are caught and
   * passed to the error handler.
   *
   * @param connection - The connection to open
   */
  open(connection: Connection): void {
    try {
      this.ensureWithinConnectionLimit(connection);
      this.verifyOrigin(connection);

      connection.touch();

      this.handler.handle(connection, 'pusher:connection_established');

      this.logger.info('Connection Established', connection.id());
    } catch (error) {
      this.error(connection, error as Error);
    }
  }

  /**
   * Handle a new message received by the connected client.
   *
   * Parses the incoming JSON message, validates its structure, and routes it
   * to either the EventHandler (for pusher: events) or ClientEvent handler
   * (for client- events).
   *
   * Message data fields that contain JSON strings are automatically parsed
   * into objects for easier handling by downstream handlers.
   *
   * @param from - The connection that sent the message
   * @param message - The raw message string (must be valid JSON)
   */
  message(from: Connection, message: string): void {
    this.logger.info('Message Received', from.id());
    this.logger.message(message);

    from.touch();

    try {
      // Parse the JSON message
      const event = JSON.parse(message) as PusherMessage;

      // Parse nested JSON in data field if it's a string
      if (typeof event.data === 'string' && this.isJson(event.data)) {
        event.data = JSON.parse(event.data);
      }

      // Validate that event field exists and is a string
      if (!event.event || typeof event.event !== 'string') {
        throw new Error('Invalid message format: missing or invalid event field');
      }

      // Route to appropriate handler based on event prefix
      if (event.event.startsWith('pusher:')) {
        this.handler.handle(
          from,
          event.event,
          (event.data || {}) as Record<string, any>
        );
      } else {
        this.clientEvent.handle(from, event);
      }

      this.logger.info('Message Handled', from.id());

      // Dispatch MessageReceived event for observability
      MessageReceived.dispatch(from, message);
    } catch (error) {
      this.error(from, error as Error);
    }
  }

  /**
   * Handle a low-level WebSocket control frame.
   *
   * Processes control frames (PING, PONG, CLOSE) according to RFC 6455.
   * When a control frame is received, marks the connection as using control
   * frames for activity tracking.
   *
   * PING and PONG frames update the connection's lastSeenAt timestamp to
   * keep the connection alive.
   *
   * @param from - The connection that sent the control frame
   * @param frame - The control frame (PING, PONG, or CLOSE)
   */
  control(from: Connection, frame: Frame): void {
    this.logger.info('Control Frame Received', from.id());
    this.logger.message(String(frame));

    from.setUsesControlFrames();

    // PING = 0x9, PONG = 0xA (RFC 6455)
    const PING: FrameOpcode = 0x9 as FrameOpcode;
    const PONG: FrameOpcode = 0xa as FrameOpcode;

    if (frame.opcode === PING || frame.opcode === PONG) {
      from.touch();
    }
  }

  /**
   * Handle a client disconnection.
   *
   * Unsubscribes the connection from all channels and cleanly terminates
   * the WebSocket connection.
   *
   * @param connection - The connection to close
   */
  close(connection: Connection): void {
    this.channels
      .for(connection.app())
      .unsubscribeFromAll(connection);

    connection.disconnect();

    this.logger.info('Connection Closed', connection.id());
  }

  /**
   * Handle an error.
   *
   * Processes errors that occur during message handling or connection lifecycle.
   * PusherException instances are sent back to the client with their formatted
   * payload. Other exceptions result in a generic "Invalid message format" error.
   *
   * All errors are logged for debugging and monitoring.
   *
   * @param connection - The connection that experienced the error
   * @param exception - The error that occurred
   */
  error(connection: Connection, exception: Error): void {
    if (exception instanceof PusherException) {
      connection.send(JSON.stringify(exception.payload()));

      this.logger.error(`Message from ${connection.id()} resulted in a pusher error`);
      this.logger.info(exception.message);

      return;
    }

    // Send generic error for non-Pusher exceptions
    connection.send(
      JSON.stringify({
        event: 'pusher:error',
        data: JSON.stringify({
          code: PusherErrorCode.INVALID_MESSAGE_FORMAT,
          message: 'Invalid message format',
        }),
      })
    );

    this.logger.error(`Message from ${connection.id()} resulted in an unknown error`);
    this.logger.info(exception.message);
  }

  /**
   * Ensure the server is within the connection limit.
   *
   * Checks if the application has a maximum connection limit configured,
   * and if so, verifies that the current connection count is below that limit.
   *
   * @param connection - The connection to validate
   * @throws ConnectionLimitExceeded if the connection limit has been reached
   */
  protected ensureWithinConnectionLimit(connection: Connection): void {
    if (!connection.app().hasMaxConnectionLimit()) {
      return;
    }

    const connections = this.channels.for(connection.app()).connections();
    const maxConnections = connection.app().maxConnections();

    if (connections && maxConnections !== null && Object.keys(connections).length >= maxConnections) {
      throw new ConnectionLimitExceeded();
    }
  }

  /**
   * Verify the origin of the connection.
   *
   * Checks if the connection's origin is in the application's allowed origins list.
   * If '*' is in the allowed origins, all origins are permitted.
   *
   * Uses wildcard pattern matching to support patterns like '*.example.com'.
   *
   * @param connection - The connection to verify
   * @throws InvalidOrigin if the connection origin is not allowed
   */
  protected verifyOrigin(connection: Connection): void {
    const allowedOrigins = connection.app().allowedOrigins();

    if (allowedOrigins.includes('*')) {
      return;
    }

    const origin = connection.getOrigin();
    if (!origin) {
      throw new InvalidOrigin();
    }

    // Extract hostname from origin URL
    let hostname: string | null = null;
    try {
      const url = new URL(origin);
      hostname = url.hostname;
    } catch {
      // If URL parsing fails, use the origin as-is
      hostname = origin;
    }

    // Check if hostname matches any allowed origin pattern
    if (hostname) {
      for (const allowedOrigin of allowedOrigins) {
        if (this.matchesPattern(allowedOrigin, hostname)) {
          return;
        }
      }
    }

    throw new InvalidOrigin();
  }

  /**
   * Check if a value matches a wildcard pattern.
   *
   * Supports simple wildcard patterns using '*' as a wildcard character.
   * Examples:
   * - '*.example.com' matches 'foo.example.com' and 'bar.example.com'
   * - 'example.*' matches 'example.com' and 'example.org'
   * - '*' matches anything
   *
   * @param pattern - The pattern to match against (may contain '*' wildcards)
   * @param value - The value to test
   * @returns true if the value matches the pattern
   */
  protected matchesPattern(pattern: string, value: string): boolean {
    if (pattern === '*') {
      return true;
    }

    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*'); // Convert * to .*

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(value);
  }

  /**
   * Check if a string is valid JSON.
   *
   * @param str - The string to test
   * @returns true if the string is valid JSON, false otherwise
   */
  protected isJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }
}
