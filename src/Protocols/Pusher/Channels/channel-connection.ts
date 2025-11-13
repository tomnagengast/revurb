import type { Connection } from "../../../contracts/connection";

/**
 * ChannelConnection - Wraps a Connection with Channel-Specific Data
 *
 * Represents a connection's subscription to a specific channel. Wraps the
 * underlying Connection with additional channel-specific data (e.g., user info
 * for presence channels).
 *
 * Key Responsibilities:
 * - Store channel-specific connection data (presence info, auth data, etc.)
 * - Provide access to the underlying Connection
 * - Proxy method calls to the underlying Connection
 * - Offer convenient data access methods
 *
 * Architecture Notes:
 * - Acts as a decorator/wrapper around Connection
 * - Stores arbitrary data as a key-value store (Map)
 * - Provides type-safe data access methods
 * - Used by Channel implementations to track subscribers with metadata
 *
 * @example
 * ```typescript
 * // Create a channel connection with presence data
 * const channelConn = new ChannelConnection(connection, new Map([
 *   ['user_id', '123'],
 *   ['user_info', { name: 'Alice', status: 'online' }]
 * ]));
 *
 * // Access the underlying connection
 * const conn = channelConn.connection();
 *
 * // Get specific data
 * const userId = channelConn.data('user_id'); // '123'
 *
 * // Get all data
 * const allData = channelConn.data(); // Map of all data
 *
 * // Send a message (proxied to connection)
 * channelConn.send(JSON.stringify({ event: 'message' }));
 * ```
 */
export class ChannelConnection {
	/**
	 * Create a new channel connection instance.
	 *
	 * @param _connection - The underlying Connection instance
	 * @param _data - Optional key-value data associated with this subscription
	 */
	constructor(
		private readonly _connection: Connection,
		private readonly _data: Map<string, unknown> = new Map(),
	) {}

	/**
	 * Get the underlying connection.
	 *
	 * Returns the raw Connection instance wrapped by this ChannelConnection.
	 * Use this to access connection-level methods and properties.
	 *
	 * @returns The underlying Connection instance
	 *
	 * @example
	 * ```typescript
	 * const conn = channelConn.connection();
	 * const socketId = conn.id();
	 * const isActive = conn.isActive();
	 * ```
	 */
	connection(): Connection {
		return this._connection;
	}

	/**
	 * Get channel-specific connection data.
	 *
	 * Retrieves data associated with this channel subscription. If a key is
	 * provided, returns the value for that specific key. If no key is provided,
	 * returns the entire data Map.
	 *
	 * @param key - Optional key to retrieve specific data
	 * @returns The data value for the key, or the entire data Map if no key provided
	 *
	 * @example
	 * ```typescript
	 * // Get specific data
	 * const userId = channelConn.data('user_id'); // Returns string | undefined
	 *
	 * // Get all data
	 * const allData = channelConn.data(); // Returns Map<string, unknown>
	 * ```
	 */
	data(): Map<string, unknown>;
	data(key: string): unknown;
	data(key?: string): Map<string, unknown> | unknown {
		if (key !== undefined) {
			return this._data.get(key);
		}
		return this._data;
	}

	/**
	 * Send a message to the connection.
	 *
	 * Convenience method that delegates to the underlying connection's send method.
	 * Used to send messages to this specific channel subscriber.
	 *
	 * @param message - The message to send (typically JSON-encoded string)
	 *
	 * @example
	 * ```typescript
	 * channelConn.send(JSON.stringify({
	 *   event: 'pusher_internal:member_added',
	 *   channel: 'presence-room',
	 *   data: JSON.stringify({ user_id: '123' })
	 * }));
	 * ```
	 */
	send(message: string): void {
		this._connection.send(message);
	}

	/**
	 * Get the normalized socket ID.
	 *
	 * Proxies to the underlying connection's id() method.
	 *
	 * @returns The normalized socket ID
	 */
	id(): string {
		return this._connection.id();
	}

	/**
	 * Determine whether the connection is stale.
	 *
	 * Proxies to the underlying connection's isStale() method.
	 * A connection is stale if it's inactive and has been pinged but not responded.
	 *
	 * @returns true if connection is stale, false otherwise
	 */
	isStale(): boolean {
		return this._connection.isStale();
	}

	/**
	 * Disconnect and unsubscribe from all channels.
	 *
	 * Proxies to the underlying connection's disconnect() method.
	 */
	disconnect(): void {
		this._connection.disconnect();
	}
}
