import type { Connection } from '../../../contracts/connection';
import type { ILogger } from '../../../contracts/logger';
import { PrivateChannel } from './private-channel';
import type { ChannelConnectionManager, ChannelManager } from './channel';

/**
 * Presence Channel
 *
 * Extends PrivateChannel to provide presence functionality, tracking which users
 * are subscribed to the channel. Presence channels require authentication like
 * private channels, but also track user information and broadcast member join/leave
 * events to all subscribers.
 *
 * Key Features:
 * - User presence tracking with user_id and user_info
 * - Member added/removed events (pusher_internal:member_added/removed)
 * - Prevents duplicate member_added events for same user_id
 * - Provides presence data (count, ids, hash) on subscription
 *
 * Channel Name Format:
 * - presence-{channel-name}
 * - presence-cache-{channel-name} (cached variant)
 *
 * Authentication:
 * - Requires auth signature (inherited from PrivateChannel)
 * - Requires channel_data with user_id and optional user_info
 *
 * Presence Data Structure:
 * {
 *   presence: {
 *     count: number,    // Total unique users
 *     ids: string[],    // Array of user_id values
 *     hash: {           // Map of user_id to user_info
 *       [user_id]: user_info
 *     }
 *   }
 * }
 *
 * @example
 * ```typescript
 * const channel = new PresenceChannel(
 *   'presence-chat-room',
 *   channelConnectionManager,
 *   channelManager,
 *   logger
 * );
 * const userData = JSON.stringify({
 *   user_id: '123',
 *   user_info: { name: 'John Doe', avatar: 'https://...' }
 * });
 * await channel.subscribe(connection, authSignature, userData);
 * ```
 */
export class PresenceChannel extends PrivateChannel {
  /**
   * Create a new presence channel instance.
   *
   * @param name - The channel name
   * @param channelConnectionManager - Manager for handling channel connections
   * @param channelManager - Manager for handling channels
   * @param logger - Logger instance for logging channel operations
   */
  constructor(
    name: string,
    channelConnectionManager: ChannelConnectionManager,
    channelManager: ChannelManager,
    logger: ILogger
  ) {
    super(name, channelConnectionManager, channelManager, logger);
  }
  /**
   * Subscribe to the presence channel.
   *
   * Verifies authentication, checks if user is already subscribed, adds connection,
   * and broadcasts member_added event to existing members (excluding the new member).
   *
   * If the user is already subscribed (same user_id on different connection),
   * adds the connection but does NOT broadcast member_added again.
   *
   * @param connection - The connection to subscribe
   * @param auth - The authentication signature
   * @param data - JSON-encoded user data containing user_id and optional user_info
   * @throws {ConnectionUnauthorized} If authentication fails
   * @throws {SyntaxError} If data is invalid JSON
   */
  override subscribe(connection: Connection, auth: string | null = null, data: string | null = null): void {
    // Verify authentication (inherited from PrivateChannel)
    this.verify(connection, auth, data);

    // Parse user data
    const userData = data ? JSON.parse(data) : {};
    const userId = userData.user_id ?? null;

    // Check if this user is already subscribed
    const userAlreadySubscribed = this.userIsSubscribed(userId);

    // Add connection to channel
    super.subscribe(connection, auth, data);

    // Only broadcast member_added if this is a NEW user (not already subscribed)
    if (!userAlreadySubscribed) {
      // Broadcast member_added to all other connections
      this.broadcastInternally(
        {
          event: 'pusher_internal:member_added',
          data: JSON.stringify(userData),
          channel: this.name(),
        },
        connection
      );
    }
  }

  /**
   * Unsubscribe from the presence channel.
   *
   * Removes the connection and broadcasts member_removed event if this was the
   * last connection for the user (no other connections with same user_id remain).
   *
   * @param connection - The connection to unsubscribe
   */
  override unsubscribe(connection: Connection): void {
    // Get subscription data before removing
    const subscription = this._connections.find(connection);

    // Remove connection from channel
    super.unsubscribe(connection);

    // Check if we should broadcast member_removed
    // Only broadcast if:
    // 1. Subscription existed
    // 2. Subscription had a user_id
    // 3. No other connections with same user_id remain
    if (
      !subscription ||
      !subscription.data('user_id') ||
      this.userIsSubscribed(subscription.data('user_id') as string)
    ) {
      return;
    }

    // Broadcast member_removed to all remaining connections
    this.broadcast(
      {
        event: 'pusher_internal:member_removed',
        data: JSON.stringify({ user_id: subscription.data('user_id') }),
        channel: this.name(),
      },
      connection
    );
  }

  /**
   * Get the presence data for the channel.
   *
   * Returns presence information including count of unique users, array of user IDs,
   * and hash mapping user_id to user_info.
   *
   * If any connection is missing user_id, returns empty presence data to indicate
   * an invalid state (all presence channel connections must have user_id).
   *
   * @returns Presence data object with count, ids, and hash
   */
  override data(): Record<string, unknown> {
    // Get all connections and extract their data
    const allConnections = Object.values(this._connections.all());

    // Get unique users (deduplicate by user_id)
    const uniqueUsers = new Map<string, Map<string, unknown>>();

    for (const channelConnection of allConnections) {
      const connectionData = channelConnection.data() as Map<string, unknown>;
      const userId = connectionData.get('user_id') as string | undefined;

      // If any connection is missing user_id, return empty presence
      if (!userId) {
        return {
          presence: {
            count: 0,
            ids: [],
            hash: {},
          },
        };
      }

      // Store unique user (last connection's data wins if multiple connections per user)
      if (!uniqueUsers.has(userId)) {
        uniqueUsers.set(userId, connectionData);
      }
    }

    // Build presence data
    const ids: string[] = [];
    const hash: Record<string, unknown> = {};

    for (const [userId, userData] of uniqueUsers) {
      ids.push(userId);
      // Map user_id to user_info (may be undefined)
      hash[userId] = userData.get('user_info') ?? {};
    }

    return {
      presence: {
        count: uniqueUsers.size,
        ids,
        hash,
      },
    };
  }

  /**
   * Determine if the given user is subscribed to the channel.
   *
   * Checks if any connection on the channel has the specified user_id.
   * Used to prevent duplicate member_added events for the same user.
   *
   * @param userId - The user ID to check
   * @returns true if user is subscribed, false otherwise
   * @protected
   */
  protected userIsSubscribed(userId: string | null): boolean {
    if (!userId) {
      return false;
    }

    // Check if any connection has this user_id
    const allConnections = Object.values(this._connections.all());

    for (const channelConnection of allConnections) {
      const connectionData = channelConnection.data() as Map<string, unknown>;
      const connectionUserId = String(connectionData.get('user_id') ?? '');

      if (connectionUserId === userId) {
        return true;
      }
    }

    return false;
  }
}
