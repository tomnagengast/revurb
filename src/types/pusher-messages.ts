/**
 * Pusher Protocol Message Type Definitions
 *
 * This file contains comprehensive TypeScript type definitions for the Pusher Protocol,
 * implementing the WebSocket message formats used by Pusher-compatible servers.
 *
 * References:
 * - Pusher Protocol Specification
 * - Laravel Reverb implementation
 * - RFC 6455 WebSocket Protocol
 *
 * @see https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/
 */

// ============================================================================
// Base Message Types
// ============================================================================

/**
 * Base interface for all Pusher protocol messages.
 * All messages must have an 'event' field that identifies the message type.
 * The data field can be either a JSON string or a parsed object.
 */
export interface PusherMessage {
  event: string;
  data?: string | Record<string, unknown> | unknown;
  channel?: string;
  [key: string]: unknown;
}

/**
 * Generic message with typed data payload
 */
export interface PusherMessageWithData<_T = unknown> extends PusherMessage {
  data: string; // JSON-encoded string containing type _T
  channel?: string;
}

// ============================================================================
// Server → Client Messages
// ============================================================================

/**
 * Connection established message (pusher:connection_established)
 * Sent when a WebSocket connection is successfully established.
 */
export interface ConnectionEstablishedMessage extends PusherMessage {
  event: "pusher:connection_established";
  data: string; // JSON-encoded ConnectionEstablishedData
}

/**
 * Data payload for pusher:connection_established message
 */
export interface ConnectionEstablishedData {
  socket_id: string;
  activity_timeout: number; // seconds
}

/**
 * Error message (pusher:error)
 * Sent when an error occurs during message processing or connection handling.
 */
export interface ErrorMessage extends PusherMessage {
  event: "pusher:error";
  data: string; // JSON-encoded ErrorData
}

/**
 * Data payload for pusher:error message
 */
export interface ErrorData {
  code: PusherErrorCode;
  message: string;
}

/**
 * Pong message (pusher:pong)
 * Response to a pusher:ping message to keep the connection alive.
 */
export interface PongMessage extends PusherMessage {
  event: "pusher:pong";
  data?: string; // Empty object "{}"
}

/**
 * Ping message (pusher:ping)
 * Sent by server to check connection health when using application-level pings.
 */
export interface PingMessage extends PusherMessage {
  event: "pusher:ping";
  data?: string; // Empty object "{}"
}

/**
 * Cache miss message (pusher:cache_miss)
 * Sent when subscribing to a cache channel that has no cached data.
 */
export interface CacheMissMessage extends PusherMessage {
  event: "pusher:cache_miss";
  channel: string;
}

/**
 * Subscription succeeded message (pusher_internal:subscription_succeeded)
 * Sent when a channel subscription is successful.
 */
export interface SubscriptionSucceededMessage extends PusherMessage {
  event: "pusher_internal:subscription_succeeded";
  data: string; // JSON-encoded channel data
  channel: string;
}

/**
 * Data payload for subscription_succeeded on presence channels
 */
export interface PresenceChannelData {
  presence: {
    count: number;
    ids: string[];
    hash: Record<string, unknown>; // user_id → user_info mapping
  };
}

/**
 * Subscription error message (pusher_internal:subscription_error)
 * Sent when a channel subscription fails.
 */
export interface SubscriptionErrorMessage extends PusherMessage {
  event: "pusher_internal:subscription_error";
  data: string; // JSON-encoded error details
  channel: string;
}

/**
 * Member added message (pusher_internal:member_added)
 * Sent to presence channel members when a new member joins.
 */
export interface MemberAddedMessage extends PusherMessage {
  event: "pusher_internal:member_added";
  data: string; // JSON-encoded user data
  channel: string;
}

/**
 * Data payload for member_added message
 */
export interface MemberData {
  user_id: string;
  user_info?: Record<string, unknown>;
}

/**
 * Member removed message (pusher_internal:member_removed)
 * Sent to presence channel members when a member leaves.
 */
export interface MemberRemovedMessage extends PusherMessage {
  event: "pusher_internal:member_removed";
  data: string; // JSON-encoded { user_id: string }
  channel: string;
}

/**
 * Data payload for member_removed message
 */
export interface MemberRemovedData {
  user_id: string;
}

// ============================================================================
// Client → Server Messages
// ============================================================================

/**
 * Data payload for pusher:subscribe message
 */
export interface SubscribeData {
  channel: string;
  auth?: string; // HMAC signature for private/presence channels
  channel_data?: string; // JSON-encoded user data for presence channels
}

/**
 * Subscribe message (pusher:subscribe)
 * Sent by client to subscribe to a channel.
 */
export interface SubscribeMessage extends PusherMessage {
  event: "pusher:subscribe";
  data: SubscribeData;
}

/**
 * Data payload for pusher:unsubscribe message
 */
export interface UnsubscribeData {
  channel: string;
}

/**
 * Unsubscribe message (pusher:unsubscribe)
 * Sent by client to unsubscribe from a channel.
 */
export interface UnsubscribeMessage extends PusherMessage {
  event: "pusher:unsubscribe";
  data: UnsubscribeData;
}

/**
 * Ping message from client (pusher:ping)
 * Sent by client to keep the connection alive.
 */
export interface ClientPingMessage extends PusherMessage {
  event: "pusher:ping";
  data?: Record<string, never>; // Empty object
}

/**
 * Pong message from client (pusher:pong)
 * Response to server's pusher:ping message.
 */
export interface ClientPongMessage extends PusherMessage {
  event: "pusher:pong";
  data?: Record<string, never>; // Empty object
}

/**
 * Client event message (client-*)
 * Custom events sent between clients on a channel.
 * Client events must be prefixed with "client-".
 */
export interface ClientEventMessage extends PusherMessage {
  event: `client-${string}`;
  data: Record<string, unknown> | string;
  channel: string;
}

// ============================================================================
// Discriminated Union Types
// ============================================================================

/**
 * All possible messages sent from Server → Client
 */
export type ServerToClientMessage =
  | ConnectionEstablishedMessage
  | ErrorMessage
  | PongMessage
  | PingMessage
  | CacheMissMessage
  | SubscriptionSucceededMessage
  | SubscriptionErrorMessage
  | MemberAddedMessage
  | MemberRemovedMessage
  | ClientEventMessage; // Broadcasted client events

/**
 * All possible messages sent from Client → Server
 */
export type ClientToServerMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | ClientPingMessage
  | ClientPongMessage
  | ClientEventMessage;

/**
 * Union of all Pusher protocol messages
 */
export type AnyPusherMessage = ServerToClientMessage | ClientToServerMessage;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Pusher protocol error codes
 * Error codes in the 4000-4999 range indicate client errors.
 */
export enum PusherErrorCode {
  /**
   * Application only accepts SSL connections (error 4000)
   * The client attempted to connect without TLS when the application requires it.
   */
  SSL_ONLY = 4000,

  /**
   * Application does not exist (error 4001)
   * The app_key provided does not correspond to a known application.
   */
  APP_NOT_FOUND = 4001,

  /**
   * Application is over connection quota (error 4004)
   * The application has exceeded its maximum allowed concurrent connections.
   */
  CONNECTION_LIMIT_EXCEEDED = 4004,

  /**
   * Origin not allowed (error 4009)
   * The connection origin is not in the application's allowed origins list.
   */
  INVALID_ORIGIN = 4009,

  /**
   * Invalid event data format (error 4100)
   * The event payload is malformed or invalid JSON.
   */
  INVALID_EVENT_DATA = 4100,

  /**
   * Invalid message format (error 4200)
   * The message structure does not conform to Pusher protocol.
   */
  INVALID_MESSAGE_FORMAT = 4200,

  /**
   * Pong timeout (error 4201)
   * The connection failed to respond to ping within the activity timeout period.
   */
  PONG_TIMEOUT = 4201,

  /**
   * Subscription to channel failed (error 4301)
   * Channel subscription failed due to authorization or validation errors.
   */
  SUBSCRIPTION_FAILED = 4301,
}

/**
 * Map error codes to human-readable messages
 */
export const PusherErrorMessages: Record<PusherErrorCode, string> = {
  [PusherErrorCode.SSL_ONLY]: "This application only accepts SSL connections",
  [PusherErrorCode.APP_NOT_FOUND]: "Application does not exist",
  [PusherErrorCode.CONNECTION_LIMIT_EXCEEDED]:
    "Application is over connection quota",
  [PusherErrorCode.INVALID_ORIGIN]: "Origin not allowed",
  [PusherErrorCode.INVALID_EVENT_DATA]: "Invalid event data",
  [PusherErrorCode.INVALID_MESSAGE_FORMAT]: "Invalid message format",
  [PusherErrorCode.PONG_TIMEOUT]: "Pong reply not received in time",
  [PusherErrorCode.SUBSCRIPTION_FAILED]: "Subscription to channel failed",
};

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Channel type identifiers based on channel name prefix
 */
export enum ChannelType {
  PUBLIC = "public",
  PRIVATE = "private",
  PRESENCE = "presence",
  CACHE = "cache",
  PRIVATE_CACHE = "private-cache",
  PRESENCE_CACHE = "presence-cache",
}

/**
 * Channel name prefixes for type detection
 */
export const ChannelPrefixes = {
  PRIVATE_CACHE: "private-cache-",
  PRESENCE_CACHE: "presence-cache-",
  CACHE: "cache-",
  PRIVATE: "private-",
  PRESENCE: "presence-",
} as const;

/**
 * Determine the channel type from a channel name
 * Order matters - most specific prefixes must be checked first
 */
export function getChannelType(channelName: string): ChannelType {
  if (channelName.startsWith(ChannelPrefixes.PRIVATE_CACHE)) {
    return ChannelType.PRIVATE_CACHE;
  }
  if (channelName.startsWith(ChannelPrefixes.PRESENCE_CACHE)) {
    return ChannelType.PRESENCE_CACHE;
  }
  if (channelName.startsWith(ChannelPrefixes.CACHE)) {
    return ChannelType.CACHE;
  }
  if (channelName.startsWith(ChannelPrefixes.PRIVATE)) {
    return ChannelType.PRIVATE;
  }
  if (channelName.startsWith(ChannelPrefixes.PRESENCE)) {
    return ChannelType.PRESENCE;
  }
  return ChannelType.PUBLIC;
}

/**
 * Check if a channel requires authentication
 */
export function requiresAuthentication(channelName: string): boolean {
  const type = getChannelType(channelName);
  return type !== ChannelType.PUBLIC && type !== ChannelType.CACHE;
}

/**
 * Check if a channel is a presence channel
 */
export function isPresenceChannel(channelName: string): boolean {
  const type = getChannelType(channelName);
  return type === ChannelType.PRESENCE || type === ChannelType.PRESENCE_CACHE;
}

/**
 * Check if a channel is a cache channel
 */
export function isCacheChannel(channelName: string): boolean {
  const type = getChannelType(channelName);
  return (
    type === ChannelType.CACHE ||
    type === ChannelType.PRIVATE_CACHE ||
    type === ChannelType.PRESENCE_CACHE
  );
}

// ============================================================================
// Message Parsing & Validation
// ============================================================================

/**
 * Type guard to check if a message is a valid Pusher message
 */
export function isPusherMessage(data: unknown): data is PusherMessage {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return typeof obj.event === "string" && obj.event.length > 0;
}

/**
 * Type guard to check if an event is a client event
 */
export function isClientEvent(event: string): event is `client-${string}` {
  return event.startsWith("client-");
}

/**
 * Type guard to check if an event is a Pusher system event
 */
export function isPusherEvent(event: string): boolean {
  return event.startsWith("pusher:") || event.startsWith("pusher_internal:");
}

/**
 * Parse a Pusher message data field (handles JSON-encoded strings)
 */
export function parseMessageData<T = unknown>(
  data: string | Record<string, unknown> | undefined,
): T | undefined {
  if (data === undefined) {
    return undefined;
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch {
      return undefined;
    }
  }

  return data as T;
}

/**
 * Format data for inclusion in a Pusher message
 * Converts objects to JSON strings as required by Pusher protocol
 */
export function formatMessageData(
  data: Record<string, unknown> | undefined,
): string | undefined {
  if (data === undefined || Object.keys(data).length === 0) {
    return undefined;
  }

  return JSON.stringify(data);
}

// ============================================================================
// Message Factory Functions
// ============================================================================

/**
 * Create a pusher:connection_established message
 */
export function createConnectionEstablishedMessage(
  socketId: string,
  activityTimeout: number,
): ConnectionEstablishedMessage {
  return {
    event: "pusher:connection_established",
    data: JSON.stringify({
      socket_id: socketId,
      activity_timeout: activityTimeout,
    }),
  };
}

/**
 * Create a pusher:error message
 */
export function createErrorMessage(
  code: PusherErrorCode,
  message?: string,
): ErrorMessage {
  return {
    event: "pusher:error",
    data: JSON.stringify({
      code,
      message: message || PusherErrorMessages[code],
    }),
  };
}

/**
 * Create a pusher:pong message
 */
export function createPongMessage(): PongMessage {
  return {
    event: "pusher:pong",
    data: "{}",
  };
}

/**
 * Create a pusher:ping message
 */
export function createPingMessage(): PingMessage {
  return {
    event: "pusher:ping",
    data: "{}",
  };
}

/**
 * Create a pusher_internal:subscription_succeeded message
 */
export function createSubscriptionSucceededMessage(
  channel: string,
  data: Record<string, unknown> = {},
): SubscriptionSucceededMessage {
  return {
    event: "pusher_internal:subscription_succeeded",
    data: JSON.stringify(data),
    channel,
  };
}

/**
 * Create a pusher_internal:member_added message
 */
export function createMemberAddedMessage(
  channel: string,
  memberData: MemberData,
): MemberAddedMessage {
  return {
    event: "pusher_internal:member_added",
    data: JSON.stringify(memberData),
    channel,
  };
}

/**
 * Create a pusher_internal:member_removed message
 */
export function createMemberRemovedMessage(
  channel: string,
  userId: string,
): MemberRemovedMessage {
  return {
    event: "pusher_internal:member_removed",
    data: JSON.stringify({ user_id: userId }),
    channel,
  };
}

/**
 * Create a pusher:cache_miss message
 */
export function createCacheMissMessage(channel: string): CacheMissMessage {
  return {
    event: "pusher:cache_miss",
    channel,
  };
}
