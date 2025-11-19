import type { Connection } from "../../contracts/connection";
import type { ILogger } from "../../contracts/logger";
import type { Frame, FrameOpcode } from "../../contracts/websocket-connection";
import { MessageReceived } from "../../events/message-received";
import type { PusherMessage } from "../../types/pusher-messages";
import { PusherErrorCode } from "../../types/pusher-messages";
import type { ClientEvent } from "./client-event";
import type { ChannelManager } from "./contracts/channel-manager";
import type { EventHandler } from "./event-handler";
import { ConnectionLimitExceeded } from "./exceptions/connection-limit-exceeded";
import { InvalidOrigin } from "./exceptions/invalid-origin";
import { PusherException } from "./exceptions/pusher-exception";

/**
 * Pusher Protocol Server
 *
 * Handles the WebSocket server lifecycle for the Pusher protocol.
 */
export class Server {
  /**
   * Create a new server instance.
   *
   * @param channels - The channel manager
   * @param handler - The event handler
   * @param clientEvent - The client event handler
   * @param logger - The logger instance
   */
  constructor(
    protected readonly channels: ChannelManager,
    protected readonly handler: EventHandler,
    protected readonly clientEvent: ClientEvent,
    protected readonly logger: ILogger,
  ) {}

  /**
   * Handle a client connection.
   *
   * @param connection - The connection to open
   */
  open(connection: Connection): void {
    try {
      this.ensureWithinConnectionLimit(connection);
      this.verifyOrigin(connection);

      connection.touch();

      this.handler.handle(connection, "pusher:connection_established");

      this.logger.info("Connection Established", connection.id());
    } catch (error) {
      this.error(connection, error as Error);
    }
  }

  /**
   * Handle a new message received by the connected client.
   *
   * @param from - The connection that sent the message
   * @param message - The raw message string
   */
  message(from: Connection, message: string): void {
    this.logger.info("Message Received", from.id());
    this.logger.message(message);

    from.touch();

    try {
      // Parse the JSON message
      const event = JSON.parse(message) as PusherMessage;

      // Parse nested JSON in data field if it's a string
      if (typeof event.data === "string" && this.isJson(event.data)) {
        event.data = JSON.parse(event.data);
      }

      // Validate that event field exists and is a string
      if (!event.event || typeof event.event !== "string") {
        throw new Error(
          "Invalid message format: missing or invalid event field",
        );
      }

      // Route to appropriate handler based on event prefix
      if (event.event.startsWith("pusher:")) {
        this.handler.handle(
          from,
          event.event,
          (event.data || {}) as Record<string, unknown>,
        );
      } else {
        this.clientEvent.handle(from, event);
      }

      this.logger.info("Message Handled", from.id());

      // Dispatch MessageReceived event for observability
      MessageReceived.dispatch(from, message);
    } catch (error) {
      this.error(from, error as Error);
    }
  }

  /**
   * Handle a low-level WebSocket control frame.
   *
   * @param from - The connection that sent the control frame
   * @param frame - The control frame
   */
  control(from: Connection, frame: Frame): void {
    this.logger.info("Control Frame Received", from.id());
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
   * @param connection - The connection to close
   */
  close(connection: Connection): void {
    this.channels.for(connection.app()).unsubscribeFromAll(connection);

    connection.disconnect();

    this.logger.info("Connection Closed", connection.id());
  }

  /**
   * Handle an error.
   *
   * @param connection - The connection that experienced the error
   * @param exception - The error that occurred
   */
  error(connection: Connection, exception: Error): void {
    if (exception instanceof PusherException) {
      connection.send(JSON.stringify(exception.payload()));

      this.logger.error(
        `Message from ${connection.id()} resulted in a pusher error`,
      );
      this.logger.info(exception.message);

      return;
    }

    // Send generic error for non-Pusher exceptions
    connection.send(
      JSON.stringify({
        event: "pusher:error",
        data: JSON.stringify({
          code: PusherErrorCode.INVALID_MESSAGE_FORMAT,
          message: "Invalid message format",
        }),
      }),
    );

    this.logger.error(
      `Message from ${connection.id()} resulted in an unknown error`,
    );
    this.logger.info(exception.message);
  }

  /**
   * Ensure the server is within the connection limit.
   *
   * @param connection - The connection to validate
   * @throws ConnectionLimitExceeded
   */
  protected ensureWithinConnectionLimit(connection: Connection): void {
    if (!connection.app().hasMaxConnectionLimit()) {
      return;
    }

    const connections = this.channels.for(connection.app()).connections();
    const maxConnections = connection.app().maxConnections();

    if (
      connections &&
      maxConnections !== null &&
      Object.keys(connections).length >= maxConnections
    ) {
      throw new ConnectionLimitExceeded();
    }
  }

  /**
   * Verify the origin of the connection.
   *
   * @param connection - The connection to verify
   * @throws InvalidOrigin
   */
  protected verifyOrigin(connection: Connection): void {
    const allowedOrigins = connection.app().allowedOrigins();

    if (allowedOrigins.includes("*")) {
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
   * @param pattern - The pattern to match against
   * @param value - The value to test
   * @returns true if the value matches the pattern
   */
  protected matchesPattern(pattern: string, value: string): boolean {
    if (pattern === "*") {
      return true;
    }

    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\\]/g, "\\$&") // Escape regex special chars
      .replace(/\*/g, ".*"); // Convert * to .*

    const regex = new RegExp(`^${regexPattern}$`, "i");
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
