import type { Connection } from '../../../contracts/connection.js';
import { CacheChannel } from './cache-channel.js';
import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';

/**
 * PresenceCacheChannel - Cache channel with presence tracking
 *
 * Combines the caching capabilities of CacheChannel with the presence tracking
 * features of presence channels. This channel type caches the last message sent
 * to the channel AND maintains a list of active users/members.
 *
 * Channel Name Pattern:
 * - Must be prefixed with "presence-cache-"
 * - Example: "presence-cache-room-123"
 *
 * Key Features:
 * - Message caching (from CacheChannel)
 * - User presence tracking (member list)
 * - Authentication required
 * - Member join/leave events
 * - Unique user tracking (prevents duplicate users)
 *
 * Event Flow:
 * 1. User subscribes with auth + user data
 * 2. If user is new → broadcast "pusher_internal:member_added"
 * 3. User receives subscription success with member list
 * 4. User unsubscribes → broadcast "pusher_internal:member_removed" (if last connection for that user)
 *
 * Trait Implementation:
 * This class implements the functionality from PHP's InteractsWithPresenceChannels trait.
 * In TypeScript, traits are implemented as methods directly in the class rather than
 * using mixins or inheritance patterns.
 *
 * @see Laravel\Reverb\Protocols\Pusher\Channels\PresenceCacheChannel (PHP)
 * @see Laravel\Reverb\Protocols\Pusher\Channels\CacheChannel (PHP)
 * @see Laravel\Reverb\Protocols\Pusher\Channels\Concerns\InteractsWithPresenceChannels (PHP)
 */
export class PresenceCacheChannel extends CacheChannel {
  /**
   * Subscribe a connection to the channel with authentication and user data.
   *
   * Presence cache channels require authentication (like private channels) and
   * user data (user_id and optional user_info). The subscription process:
   *
   * 1. Verify authentication signature
   * 2. Parse user data from channel_data
   * 3. Check if user is already subscribed
   * 4. Add connection to channel
   * 5. Broadcast member_added event (if new user)
   *
   * @param connection - The connection to subscribe
   * @param auth - HMAC signature for authentication
   * @param data - JSON-encoded user data ({ user_id, user_info })
   *
   * @throws ConnectionUnauthorized if authentication fails
   *
   * @example
   * ```typescript
   * channel.subscribe(
   *   connection,
   *   'app-key:signature',
   *   '{"user_id":"123","user_info":{"name":"Alice"}}'
   * );
   * ```
   */
  override subscribe(connection: Connection, auth: string | null = null, data: string | null = null): void {
    // Verify authentication (inherited from PrivateChannel behavior)
    this.verify(connection, auth, data);

    // Parse user data
    const userData = data ? JSON.parse(data) : {};

    // Check if user is already subscribed (don't broadcast member_added if they are)
    const alreadySubscribed = this.userIsSubscribed(userData.user_id ?? null);

    // Subscribe to the channel (adds connection to connection manager)
    super.subscribe(connection, auth, data);

    // If user was already subscribed, don't broadcast member_added
    if (alreadySubscribed) {
      return;
    }

    // Broadcast member_added event to all other subscribers
    // Use parent broadcast to avoid caching this internal event
    super.broadcastInternally(
      {
        event: 'pusher_internal:member_added',
        data: JSON.stringify(userData),
        channel: this.name(),
      },
      connection
    );
  }

  /**
   * Unsubscribe a connection from the channel.
   *
   * When a user unsubscribes, we need to:
   * 1. Remove the connection from the channel
   * 2. Check if this was the last connection for that user
   * 3. Broadcast member_removed event if user has no more connections
   *
   * @param connection - The connection to unsubscribe
   *
   * @example
   * ```typescript
   * channel.unsubscribe(connection);
   * ```
   */
  override unsubscribe(connection: Connection): void {
    // Get subscription info before removing
    const subscription = this._connections.find(connection);

    // Remove the connection
    super.unsubscribe(connection);

    // If no subscription found, or no user_id, nothing more to do
    if (!subscription || !subscription.data('user_id')) {
      return;
    }

    const userId = subscription.data('user_id') as string;

    // Check if user still has other connections
    if (this.userIsSubscribed(userId)) {
      return;
    }

    // User has no more connections - broadcast member_removed
    // Use parent broadcast (not broadcastInternally) to send to all remaining subscribers
    super.broadcast(
      {
        event: 'pusher_internal:member_removed',
        data: JSON.stringify({ user_id: userId }),
        channel: this.name(),
      },
      connection
    );
  }

  /**
   * Get the channel data (presence information).
   *
   * Returns the current presence state including:
   * - count: Number of unique users
   * - ids: Array of user IDs
   * - hash: Map of user_id → user_info
   *
   * If any connection lacks a user_id, returns empty presence data as
   * this indicates an invalid state.
   *
   * @returns Presence data structure
   *
   * @example
   * ```typescript
   * const data = channel.data();
   * // {
   * //   presence: {
   * //     count: 3,
   * //     ids: ['123', '456', '789'],
   * //     hash: {
   * //       '123': { name: 'Alice' },
   * //       '456': { name: 'Bob' },
   * //       '789': { name: 'Charlie' }
   * //     }
   * //   }
   * // }
   * ```
   */
  override data(): Record<string, any> {
    // Get all connection data and deduplicate by user_id
    const allConnections = Object.values(this._connections.all());

    // Extract data from each connection and deduplicate by user_id
    const uniqueUsersMap = new Map<string, any>();

    for (const channelConn of allConnections) {
      const connData = channelConn.data() as Map<string, unknown>;
      const userId = connData.get('user_id');
      const userInfo = connData.get('user_info');

      // If any connection lacks a user_id, return empty presence
      if (!userId) {
        return {
          presence: {
            count: 0,
            ids: [],
            hash: {},
          },
        };
      }

      // Only add if not already present (first connection wins)
      if (!uniqueUsersMap.has(userId as string)) {
        uniqueUsersMap.set(userId as string, {
          user_id: userId,
          user_info: userInfo,
        });
      }
    }

    // Build presence data structure
    const users = Array.from(uniqueUsersMap.values());
    const ids = users.map(u => u.user_id);
    const hash: Record<string, any> = {};

    for (const user of users) {
      hash[user.user_id] = user.user_info;
    }

    return {
      presence: {
        count: users.length,
        ids,
        hash,
      },
    };
  }

  /**
   * Verify authentication for private/presence channel.
   *
   * Validates the HMAC signature for the subscription request.
   * The signature is computed as:
   *   HMAC-SHA256(secret, socket_id:channel_name:channel_data)
   *
   * @param connection - The connection attempting to subscribe
   * @param auth - The authentication string (format: "key:signature")
   * @param data - The channel data (for presence channels, contains user info)
   *
   * @throws ConnectionUnauthorized if signature is invalid
   *
   * @protected
   */
  protected verify(connection: Connection, auth: string | null = null, data: string | null = null): boolean {
    // Build the signature string
    let signature = `${connection.id()}:${this.name()}`;

    if (data) {
      signature += `:${data}`;
    }

    // Extract the signature from auth (format: "key:signature")
    const providedSignature = auth?.split(':')[1] ?? '';

    // Compute expected signature
    const expectedSignature = this.computeHmac(signature, connection.app().secret());

    // Compare signatures (timing-safe comparison)
    if (!this.timingSafeEqual(expectedSignature, providedSignature)) {
      throw new Error('Connection unauthorized');
    }

    return true;
  }

  /**
   * Check if a user is currently subscribed to the channel.
   *
   * Searches all channel connections for a matching user_id.
   * Returns true if at least one connection with that user_id exists.
   *
   * @param userId - The user ID to check
   * @returns true if user is subscribed, false otherwise
   *
   * @protected
   */
  protected userIsSubscribed(userId: string | null): boolean {
    if (!userId) {
      return false;
    }

    // Check all connections for matching user_id
    const allConnections = Object.values(this._connections.all());

    for (const channelConn of allConnections) {
      const connData = channelConn.data() as Map<string, unknown>;
      const connUserId = String(connData.get('user_id') ?? '');

      if (connUserId === userId) {
        return true;
      }
    }

    return false;
  }

  /**
   * Compute HMAC-SHA256 signature.
   *
   * @param data - The data to sign
   * @param secret - The secret key
   * @returns The HMAC signature as hex string
   *
   * @private
   */
  private computeHmac(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Timing-safe string comparison.
   *
   * Prevents timing attacks by ensuring comparison takes constant time
   * regardless of where strings differ.
   *
   * @param a - First string
   * @param b - Second string
   * @returns true if strings are equal, false otherwise
   *
   * @private
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    try {
      return cryptoTimingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}
