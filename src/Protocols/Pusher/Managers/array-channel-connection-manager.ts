import type { Connection } from "../../../contracts/connection";
import { ChannelConnection } from "../channels/channel-connection";
import type { ChannelConnectionManager } from "../contracts/channel-connection-manager";

/**
 * ArrayChannelConnectionManager - In-Memory Channel Connection Manager
 *
 * Implements ChannelConnectionManager using a Map for in-memory storage of
 * channel connections. Provides fast lookups by connection ID and manages
 * the lifecycle of connections subscribed to a channel.
 *
 * Key Responsibilities:
 * - Store ChannelConnections in a Map keyed by socket ID
 * - Add connections with channel-specific metadata
 * - Remove connections by Connection instance or ID
 * - Find connections efficiently using Map lookups
 * - Track channel state (empty/has subscribers)
 * - Support channel-scoped instances via for() method
 *
 * Architecture Notes:
 * - Uses Map<string, ChannelConnection> for O(1) lookups
 * - Stateful: maintains channel name for scoped operations
 * - Thread-safe for single-threaded JS environment
 * - Suitable for production use with in-memory state
 *
 * Storage Strategy:
 * - Key: Connection socket ID (string like "123.456")
 * - Value: ChannelConnection (Connection + metadata wrapper)
 * - Benefits: Fast lookups, automatic deduplication by ID
 *
 * @example
 * ```typescript
 * const manager = new ArrayChannelConnectionManager();
 *
 * // Scope to a specific channel
 * const presenceManager = manager.for('presence-room');
 *
 * // Add a connection with presence data
 * presenceManager.add(connection, new Map([
 *   ['user_id', '123'],
 *   ['user_info', { name: 'Alice', status: 'online' }]
 * ]));
 *
 * // Find and send message
 * const channelConn = presenceManager.find(connection);
 * if (channelConn) {
 *   channelConn.send(JSON.stringify({ event: 'message' }));
 * }
 *
 * // Check if empty and clean up
 * if (presenceManager.isEmpty()) {
 *   presenceManager.flush();
 * }
 * ```
 */
export class ArrayChannelConnectionManager implements ChannelConnectionManager {
	/**
	 * The channel name this manager is scoped to.
	 *
	 * Set via the for() method to scope this manager to a specific channel.
	 * Used for channel-specific operations and logging.
	 *
	 * @protected
	 */
	protected name = "";

	/**
	 * The underlying connection storage.
	 *
	 * Map of socket ID to ChannelConnection. Provides O(1) lookups by ID
	 * and efficient iteration over all connections.
	 *
	 * Key: Connection socket ID (e.g., "123456789.987654321")
	 * Value: ChannelConnection instance (Connection + metadata)
	 *
	 * @protected
	 */
	protected connections: Map<string, ChannelConnection> = new Map();

	/**
	 * Get a channel connection manager for the given channel name.
	 *
	 * Sets the channel name for this manager instance and returns it.
	 * This allows method chaining for channel-scoped operations.
	 *
	 * @param name - The channel name to manage connections for
	 * @returns This manager instance, scoped to the channel
	 *
	 * @example
	 * ```typescript
	 * const manager = new ArrayChannelConnectionManager()
	 *   .for('presence-room')
	 *   .add(connection, data);
	 * ```
	 */
	for(name: string): ChannelConnectionManager {
		this.name = name;
		return this;
	}

	/**
	 * Add a connection to the channel.
	 *
	 * Creates a ChannelConnection wrapping the Connection with channel-specific
	 * data and stores it in the Map keyed by socket ID. If a connection with the
	 * same ID already exists, it will be replaced.
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
	add(connection: Connection, data: Map<string, unknown>): void {
		this.connections.set(
			connection.id(),
			new ChannelConnection(connection, data),
		);
	}

	/**
	 * Remove a connection from the channel.
	 *
	 * Deletes the connection from the Map by its socket ID. No-op if the
	 * connection is not in the channel.
	 *
	 * @param connection - The Connection to remove
	 *
	 * @example
	 * ```typescript
	 * manager.remove(connection);
	 * ```
	 */
	remove(connection: Connection): void {
		this.connections.delete(connection.id());
	}

	/**
	 * Find a connection in the channel.
	 *
	 * Looks up a ChannelConnection by the socket ID of the given Connection.
	 * Delegates to findById() for the actual lookup.
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
	find(connection: Connection): ChannelConnection | null {
		return this.findById(connection.id());
	}

	/**
	 * Find a connection by its socket ID.
	 *
	 * Performs a Map lookup by ID. Returns null if not found, matching the
	 * interface contract for missing keys.
	 *
	 * @param id - The socket ID to find
	 * @returns The ChannelConnection if found, null otherwise
	 *
	 * @example
	 * ```typescript
	 * const channelConn = manager.findById('123456789.987654321');
	 * ```
	 */
	findById(id: string): ChannelConnection | null {
		return this.connections.get(id) ?? null;
	}

	/**
	 * Get all connections in the channel.
	 *
	 * Returns the internal Map of all ChannelConnections. The returned Map
	 * is keyed by socket ID for efficient lookups during iteration.
	 *
	 * Note: This returns the actual Map, not a copy. Mutations will affect
	 * the manager's state. Use cautiously or iterate without modifying.
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
	all(): Map<string, ChannelConnection> {
		return this.connections;
	}

	/**
	 * Determine whether any connections remain on the channel.
	 *
	 * Returns true if the Map is empty (size === 0). Use this to determine
	 * when to clean up empty channels.
	 *
	 * @returns true if channel has no connections, false otherwise
	 *
	 * @example
	 * ```typescript
	 * if (manager.isEmpty()) {
	 *   console.log('Channel has no subscribers');
	 *   manager.flush();
	 * }
	 * ```
	 */
	isEmpty(): boolean {
		return this.connections.size === 0;
	}

	/**
	 * Flush the channel connection manager.
	 *
	 * Clears all connections from the Map. Called when cleaning up a channel
	 * or resetting state. All connections will be garbage collected if no
	 * other references exist.
	 *
	 * @example
	 * ```typescript
	 * manager.flush(); // Remove all connections
	 * console.log(manager.isEmpty()); // true
	 * ```
	 */
	flush(): void {
		this.connections.clear();
	}
}
