import type { Connection } from "../../contracts/connection";
import type { ServerProvider } from "../../contracts/server-provider";
import type { PusherMessage } from "../../types/pusher-messages";
import { isClientEvent } from "../../types/pusher-messages";
import type { ChannelManager } from "./contracts/channel-manager";
import { dispatch } from "./event-dispatcher";

/**
 * Client Event Handler
 *
 * Handles Pusher client-to-client events (events prefixed with "client-").
 * Client events allow clients to send messages directly to other clients
 * subscribed to the same channel without going through the server application.
 *
 * Client Event Rules (Pusher Protocol):
 * 1. Event name must start with "client-"
 * 2. Must include a channel name
 * 3. Can only be sent on private or presence channels (enforced by channel layer)
 * 4. Cannot be sent on public channels
 *
 * @see https://pusher.com/docs/channels/using_channels/events/#triggering-client-events
 *
 * @example
 * ```typescript
 * // Valid client event
 * const event = {
 *   event: 'client-typing',
 *   channel: 'private-chat-room-1',
 *   data: { user: 'Alice', typing: true }
 * };
 *
 * const clientEvent = new ClientEvent(channelManager, serverProvider);
 * const result = clientEvent.handle(connection, event);
 * if (result) {
 *   // Event was valid and dispatched
 * }
 * ```
 */
export class ClientEvent {
  /**
   * Create a new ClientEvent handler
   *
   * @param channels - The channel manager for finding channels to broadcast to
   * @param serverProvider - The server provider for scaling support
   */
  constructor(
    protected readonly channels?: ChannelManager,
    protected readonly serverProvider?: ServerProvider,
  ) {}
  /**
   * Handle a Pusher client event (instance method).
   *
   * Validates and processes client-to-client events, broadcasting them to
   * all connections on the same channel (excluding the sender).
   *
   * @param connection - The connection that sent the event
   * @param event - The event payload to validate and handle
   */
  handle(connection: Connection, event: PusherMessage): void {
    // Validate event structure
    const validationErrors = ClientEvent.validate(event);
    if (validationErrors.length > 0) {
      return;
    }

    // Check if event name starts with "client-"
    if (!isClientEvent(event.event)) {
      return;
    }

    // Check if channel is present
    if (!event.channel) {
      return;
    }

    // Dispatch the event
    this.dispatch(connection, event);
  }

  /**
   * Handle a Pusher client event (static method).
   *
   * Validates and processes client-to-client events. Returns a ClientEvent
   * instance if the event is valid, or null if validation fails.
   *
   * Validation Rules:
   * 1. Event field must be present and a string
   * 2. Event name must start with "client-"
   * 3. Channel field must be present and a string
   * 4. Data field is optional but must be an object or array if present
   *
   * Note: This static method doesn't perform the actual dispatch operation
   * since it has no access to the ChannelManager. The caller is responsible
   * for broadcasting the event using an instance method.
   *
   * @param connection - The connection that sent the event
   * @param event - The event payload to validate and handle
   * @returns ClientEvent instance if valid, null if invalid
   *
   * @example
   * ```typescript
   * const event = {
   *   event: 'client-message',
   *   channel: 'private-chat',
   *   data: { text: 'Hello' }
   * };
   *
   * const result = ClientEvent.handleStatic(connection, event);
   * ```
   */
  static handleStatic(
    _connection: Connection,
    event: unknown,
  ): ClientEvent | null {
    // Validate event structure
    const validationErrors = ClientEvent.validate(event);
    if (validationErrors.length > 0) {
      return null;
    }

    // TypeScript knows event is PusherMessage after validation
    const pusherEvent = event as PusherMessage;

    // Check if event name starts with "client-"
    if (!isClientEvent(pusherEvent.event)) {
      return null;
    }

    // Check if channel is present
    if (!pusherEvent.channel) {
      return null;
    }

    // Return a new ClientEvent instance (dispatch operation must be done by caller)
    return new ClientEvent();
  }

  /**
   * Dispatch the event to the channel.
   *
   * Uses the event dispatcher to broadcast the event, ensuring proper
   * scaling support if enabled.
   *
   * @param connection - The connection that sent the event
   * @param payload - The event payload to broadcast
   *
   * @private
   */
  private dispatch(connection: Connection, payload: PusherMessage): void {
    // Check if channels manager is available
    if (!this.channels || !this.serverProvider) {
      console.warn(
        "ClientEvent.dispatch: ChannelManager or ServerProvider not available",
      );
      return;
    }

    if (payload.channel) {
      dispatch(
        connection.app(),
        {
          event: payload.event,
          channel: payload.channel,
          data: payload.data,
        },
        this.channels,
        this.serverProvider,
        connection,
      );
    }
  }

  /**
   * Validate a client event payload.
   *
   * Performs comprehensive validation of the event structure according to
   * Pusher protocol requirements.
   *
   * Validation Rules:
   * - event: required, must be a non-empty string
   * - channel: required, must be a non-empty string
   * - data: optional, must be an object or array if present (not a primitive)
   *
   * @param event - The event payload to validate
   * @returns Array of validation error messages (empty if valid)
   *
   * @private
   */
  private static validate(event: unknown): string[] {
    const errors: string[] = [];

    // Check if event is an object
    if (typeof event !== "object" || event === null) {
      errors.push("Event must be an object");
      return errors;
    }

    const obj = event as Record<string, unknown>;

    // Validate 'event' field
    if (!obj.event) {
      errors.push("The event field is required");
    } else if (typeof obj.event !== "string") {
      errors.push("The event field must be a string");
    } else if (obj.event.trim() === "") {
      errors.push("The event field must not be empty");
    }

    // Validate 'channel' field
    if (!obj.channel) {
      errors.push("The channel field is required");
    } else if (typeof obj.channel !== "string") {
      errors.push("The channel field must be a string");
    } else if (obj.channel.trim() === "") {
      errors.push("The channel field must not be empty");
    }

    // Validate 'data' field (optional, but must be array/object if present)
    if (obj.data !== undefined && obj.data !== null) {
      const dataType = typeof obj.data;
      const isValidData =
        dataType === "object" || // objects and arrays
        dataType === "string" || // JSON-encoded strings are acceptable
        Array.isArray(obj.data);

      if (!isValidData) {
        errors.push("The data field must be an array, object, or string");
      }
    }

    return errors;
  }
}
