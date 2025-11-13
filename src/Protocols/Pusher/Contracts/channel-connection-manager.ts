import type { Connection } from '../../../contracts/connection';
import type { ChannelConnection } from '../channels/channel-connection';

/**
 * ChannelConnectionManager - Manages Connections for a Specific Channel
 *
 * Provides an interface for managing the set of connections subscribed to a
 * particular channel. Handles adding/removing connections, tracking connection
 * metadata, and providing access to the connection collection.
 *
 * Key Responsibilities:
 * - Maintain a collection of ChannelConnections for a channel
 * - Add connections with associated channel-specific data
 * - Remove connections when they unsubscribe
 * - Find connections by Connection or socket ID
 * - Track channel state (empty/has subscribers)
 * - Provide access to all connections on the channel
 *
 * Architecture Notes:
 * - Used by Channel implementations to manage subscribers
 * - Supports factory pattern via for() method (returns manager for specific channel)
 * - Stores ChannelConnection instances (Connection + metadata wrapper)
 * - Keyed by connection ID for efficient lookups
 *
 * @example
 * ```typescript
 * // Get manager for a specific channel
 * const manager = channelManager.for('presence-room');
 *
 * // Add a connection with presence data
 * manager.add(connection, new Map([
 *   ['user_id', '123'],
 *   ['user_info', { name: 'Alice' }]
 * ]));
 *
 * // Find a connection
 * const channelConn = manager.find(connection);
 *
 * // Check if channel is empty
 * if (manager.isEmpty()) {
 *   console.log('Channel has no subscribers');
 * }
 *
 * // Get all connections
 * const allConnections = manager.all();
 * ```
 */
export interface ChannelConnectionManager {
  /**
   * Get a channel connection manager for the given channel name.
   *
   * Factory method that returns a manager instance scoped to a specific channel.
   * May return a new instance or configure this instance for the given channel.
   *
   * @param name - The channel name to manage connections for
   * @returns A ChannelConnectionManager for the specified channel
   *
   * @example
   * ```typescript
   * const presenceManager = manager.for('presence-room');
   * const privateManager = manager.for('private-chat');
   * ```
   */
  for(name: string): ChannelConnectionManager;

  /**
   * Add a connection to the channel.
   *
   * Wraps the Connection with channel-specific data and adds it to the manager.
   * The data Map typically contains presence info, auth data, or other metadata.
   *
   * @param connection - The Connection to add
   * @param data - Key-value data associated with this channel subscription
   *
   * @example
   * ```typescript
   * manager.add(connection, new Map([
   *   ['user_id', '123'],
   *   ['user_info', { name: 'Alice', status: 'online' }]
   * ]));
   * ```
   */
  add(connection: Connection, data: Map<string, unknown>): void;

  /**
   * Remove a connection from the channel.
   *
   * Removes the connection from the manager's collection. Called when a
   * connection unsubscribes from the channel or is disconnected.
   *
   * @param connection - The Connection to remove
   *
   * @example
   * ```typescript
   * manager.remove(connection);
   * ```
   */
  remove(connection: Connection): void;

  /**
   * Find a connection in the channel.
   *
   * Looks up a ChannelConnection by its underlying Connection instance.
   * Returns null if the connection is not subscribed to this channel.
   *
   * @param connection - The Connection to find
   * @returns The ChannelConnection if found, null otherwise
   *
   * @example
   * ```typescript
   * const channelConn = manager.find(connection);
   * if (channelConn) {
   *   const userId = channelConn.data('user_id');
   * }
   * ```
   */
  find(connection: Connection): ChannelConnection | null;

  /**
   * Find a connection by its socket ID.
   *
   * Looks up a ChannelConnection by socket ID string. More efficient than
   * searching by Connection instance when you only have the ID.
   *
   * @param id - The socket ID to find
   * @returns The ChannelConnection if found, null otherwise
   *
   * @example
   * ```typescript
   * const channelConn = manager.findById('123456789.987654321');
   * ```
   */
  findById(id: string): ChannelConnection | null;

  /**
   * Get all connections in the channel.
   *
   * Returns a Map of all ChannelConnections keyed by socket ID. Use this to
   * iterate over all subscribers or broadcast messages to the channel.
   *
   * @returns Map of socket ID to ChannelConnection
   *
   * @example
   * ```typescript
   * const connections = manager.all();
   * for (const [socketId, channelConn] of connections) {
   *   channelConn.send(message);
   * }
   * ```
   */
  all(): Map<string, ChannelConnection>;

  /**
   * Determine whether any connections remain on the channel.
   *
   * Returns true if the channel has no subscribers. Use this to determine
   * when to clean up empty channels.
   *
   * @returns true if channel has no connections, false otherwise
   *
   * @example
   * ```typescript
   * if (manager.isEmpty()) {
   *   // Clean up channel resources
   *   channels.delete(channelName);
   * }
   * ```
   */
  isEmpty(): boolean;

  /**
   * Flush the channel connection manager.
   *
   * Removes all connections from the manager. Called when cleaning up
   * a channel or resetting state.
   *
   * @example
   * ```typescript
   * manager.flush(); // Remove all connections
   * ```
   */
  flush(): void;
}
