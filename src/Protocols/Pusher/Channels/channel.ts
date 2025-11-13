import type { Connection } from "../../../contracts/connection";
import type { ILogger } from "../../../contracts/logger";
import type { SerializedChannel } from "../concerns/serializes-channels";
import type { ChannelConnectionManager } from "../contracts/channel-connection-manager";
import type { ChannelConnection } from "./channel-connection";

// Re-export for convenience
export type { ChannelConnectionManager };

/**
 * ChannelManager interface
 *
 * Manages all channels for an application. Provides methods to create, find,
 * and remove channels.
 *
 * This is a local interface definition that matches the ChannelManager contract.
 */
export interface ChannelManager {
	/**
	 * Scope the channel manager to a specific application
	 *
	 * @param app - The application instance
	 * @returns A scoped channel manager
	 */
	for(app: any): ChannelManager;

	/**
	 * Remove a channel from the manager
	 *
	 * @param channel - The channel to remove
	 */
	remove(channel: Channel): void;
}

/**
 * Channel - Base channel implementation for public channels
 *
 * Represents a Pusher channel that connections can subscribe to. Handles
 * connection management, broadcasting messages, and channel lifecycle.
 *
 * Key Responsibilities:
 * - Manage channel subscriptions (add/remove connections)
 * - Broadcast messages to all subscribers
 * - Track connection state
 * - Auto-cleanup when empty
 * - Provide channel metadata
 *
 * Channel Types:
 * - Public channels (this class) - no authentication required
 * - Private channels - require authentication
 * - Presence channels - track member list
 * - Cache channels - persist messages
 *
 * Architecture Notes:
 * - Uses ChannelConnectionManager for connection storage
 * - Integrates with ChannelManager for lifecycle management
 * - Supports selective broadcasting (exclude specific connections)
 * - Automatically removed from manager when last connection leaves
 *
 * @example
 * ```typescript
 * const channel = new Channel(
 *   'my-channel',
 *   channelConnectionManager,
 *   channelManager,
 *   logger
 * );
 *
 * // Subscribe a connection
 * channel.subscribe(connection);
 *
 * // Broadcast to all
 * channel.broadcast({ event: 'message', data: 'Hello' });
 *
 * // Broadcast excluding sender
 * channel.broadcast({ event: 'message', data: 'Hello' }, senderConnection);
 *
 * // Unsubscribe
 * channel.unsubscribe(connection);
 * ```
 */
export class Channel {
	/**
	 * The channel connections manager scoped to this channel
	 */
	protected _connections: ChannelConnectionManager;

	/**
	 * Create a new channel instance.
	 *
	 * @param _name - The channel name (e.g., "my-channel", "private-chat", "presence-lobby")
	 * @param channelConnectionManager - Manager for handling channel connections
	 * @param channelManager - Manager for handling channels
	 * @param logger - Logger instance for logging channel operations
	 */
	constructor(
		protected readonly _name: string,
		protected readonly channelConnectionManager: ChannelConnectionManager,
		protected readonly channelManager: ChannelManager,
		protected readonly logger: ILogger,
	) {
		// Get a connection manager scoped to this specific channel
		this._connections = channelConnectionManager.for(this._name);
	}

	/**
	 * Get the channel name.
	 *
	 * @returns The channel name
	 *
	 * @example
	 * ```typescript
	 * const name = channel.name(); // "my-channel"
	 * ```
	 */
	name(): string {
		return this._name;
	}

	/**
	 * Get all connections for the channel.
	 *
	 * Returns an object mapping connection IDs to ChannelConnection instances.
	 * Each ChannelConnection wraps a Connection with channel-specific data.
	 *
	 * @returns Object mapping connection IDs to ChannelConnection instances
	 *
	 * @example
	 * ```typescript
	 * const connections = channel.connections();
	 * Object.values(connections).forEach(conn => {
	 *   console.log(conn.connection().id());
	 * });
	 * ```
	 */
	connections(): Record<string, ChannelConnection> {
		// Convert Map to Record for backwards compatibility
		const connectionsMap = this._connections.all();
		return Object.fromEntries(connectionsMap);
	}

	/**
	 * Find a connection.
	 *
	 * Searches for a ChannelConnection wrapper for the given Connection.
	 * Returns the underlying Connection from the ChannelConnection if found.
	 *
	 * @param connection - The connection to find
	 * @returns The Connection instance or null if not found
	 *
	 * @example
	 * ```typescript
	 * const found = channel.find(connection);
	 * if (found) {
	 *   console.log('Connection is subscribed:', found.id());
	 * }
	 * ```
	 */
	find(connection: Connection): Connection | null {
		const channelConnection = this._connections.find(connection);
		return channelConnection ? channelConnection.connection() : null;
	}

	/**
	 * Find a connection by its ID.
	 *
	 * Searches for a ChannelConnection by connection ID.
	 * Returns the underlying Connection from the ChannelConnection if found.
	 *
	 * @param id - The connection ID (e.g., "123456789.987654321")
	 * @returns The Connection instance or null if not found
	 *
	 * @example
	 * ```typescript
	 * const found = channel.findById('123456789.987654321');
	 * if (found) {
	 *   found.send(JSON.stringify({ event: 'ping' }));
	 * }
	 * ```
	 */
	findById(id: string): Connection | null {
		const channelConnection = this._connections.findById(id);
		return channelConnection ? channelConnection.connection() : null;
	}

	/**
	 * Subscribe to the channel.
	 *
	 * Adds a connection to the channel's subscriber list. For public channels,
	 * no authentication is required. Subclasses (PrivateChannel, PresenceChannel)
	 * override this to add authentication and presence logic.
	 *
	 * @param connection - The connection to subscribe
	 * @param auth - Optional authentication string (unused in public channels)
	 * @param data - Optional JSON string with subscription data
	 *
	 * @example
	 * ```typescript
	 * // Public channel - simple subscription
	 * channel.subscribe(connection);
	 *
	 * // Presence channel - with user data
	 * channel.subscribe(
	 *   connection,
	 *   'auth-signature',
	 *   JSON.stringify({ user_id: '123', user_info: { name: 'Alice' } })
	 * );
	 * ```
	 */
	subscribe(
		connection: Connection,
		_auth: string | null = null,
		data: string | null = null,
	): void {
		// Parse data if provided, otherwise use empty Map
		const parsedData = data
			? new Map(Object.entries(JSON.parse(data)))
			: new Map();
		this._connections.add(connection, parsedData);
	}

	/**
	 * Unsubscribe from the channel.
	 *
	 * Removes a connection from the channel's subscriber list. If this was the
	 * last connection, the channel is automatically removed from the channel manager.
	 *
	 * @param connection - The connection to unsubscribe
	 *
	 * @example
	 * ```typescript
	 * channel.unsubscribe(connection);
	 * // If channel is now empty, it will be removed from manager
	 * ```
	 */
	unsubscribe(connection: Connection): void {
		this._connections.remove(connection);

		// Auto-cleanup: remove channel if it has no more connections
		if (this._connections.isEmpty()) {
			this.channelManager.for(connection.app()).remove(this);
		}
	}

	/**
	 * Determine if the connection is subscribed to the channel.
	 *
	 * @param connection - The connection to check
	 * @returns true if the connection is subscribed, false otherwise
	 *
	 * @example
	 * ```typescript
	 * if (channel.subscribed(connection)) {
	 *   console.log('Already subscribed');
	 * } else {
	 *   channel.subscribe(connection);
	 * }
	 * ```
	 */
	subscribed(connection: Connection): boolean {
		return this._connections.find(connection) !== null;
	}

	/**
	 * Send a message to all connections subscribed to the channel.
	 *
	 * Broadcasts a message to all subscribers, optionally excluding one connection
	 * (typically the sender). Logs the broadcast operation and serializes the
	 * payload to JSON before sending.
	 *
	 * @param payload - The message payload as an object
	 * @param except - Optional connection to exclude from broadcast (typically the sender)
	 *
	 * @example
	 * ```typescript
	 * // Broadcast to all
	 * channel.broadcast({
	 *   event: 'new-message',
	 *   channel: 'my-channel',
	 *   data: { text: 'Hello everyone!' }
	 * });
	 *
	 * // Broadcast excluding sender
	 * channel.broadcast(
	 *   {
	 *     event: 'new-message',
	 *     channel: 'my-channel',
	 *     data: { text: 'Hello everyone!' }
	 *   },
	 *   senderConnection
	 * );
	 * ```
	 */
	broadcast(
		payload: Record<string, unknown>,
		except: Connection | null = null,
	): void {
		if (except === null) {
			this.broadcastToAll(payload);
			return;
		}

		const message = JSON.stringify(payload);

		this.logger.info("Broadcasting To", this.name());
		this.logger.message(message);

		// Send to all connections except the excluded one
		const allConnections = this._connections.all();
		for (const channelConnection of allConnections.values()) {
			const connection = channelConnection.connection();
			if (except.id() === connection.id()) {
				continue;
			}

			connection.send(message);
		}
	}

	/**
	 * Send a broadcast to all connections.
	 *
	 * Broadcasts a message to all subscribers without exceptions.
	 * Used internally by broadcast() when no connection is excluded.
	 *
	 * @param payload - The message payload as an object
	 *
	 * @example
	 * ```typescript
	 * channel.broadcastToAll({
	 *   event: 'system-message',
	 *   channel: 'my-channel',
	 *   data: { text: 'Server maintenance in 5 minutes' }
	 * });
	 * ```
	 */
	broadcastToAll(payload: Record<string, unknown>): void {
		const message = JSON.stringify(payload);

		this.logger.info("Broadcasting To", this.name());
		this.logger.message(message);

		// Send to all connections
		const allConnections = this._connections.all();
		for (const channelConnection of allConnections.values()) {
			channelConnection.connection().send(message);
		}
	}

	/**
	 * Broadcast a message triggered from an internal source.
	 *
	 * This method is called when a message is triggered internally (e.g., via HTTP API)
	 * rather than from a WebSocket client. The default implementation delegates to
	 * broadcast(), but subclasses may override to add special handling.
	 *
	 * @param payload - The message payload as an object
	 * @param except - Optional connection to exclude from broadcast
	 *
	 * @example
	 * ```typescript
	 * // Internal broadcast from HTTP trigger
	 * channel.broadcastInternally({
	 *   event: 'order-updated',
	 *   channel: 'orders',
	 *   data: { order_id: 123, status: 'shipped' }
	 * });
	 * ```
	 */
	broadcastInternally(
		payload: Record<string, unknown>,
		except: Connection | null = null,
	): void {
		this.broadcast(payload, except);
	}

	/**
	 * Get the data associated with the channel.
	 *
	 * Returns channel-specific metadata. For public channels, this returns an empty
	 * object. Subclasses (like PresenceChannel) override this to return presence data.
	 *
	 * @returns Channel-specific data object
	 *
	 * @example
	 * ```typescript
	 * // Public channel - returns {}
	 * const data = channel.data();
	 *
	 * // Presence channel - returns { presence_count: 5, presence_hash: {...} }
	 * const presenceData = presenceChannel.data();
	 * ```
	 */
	data(): Record<string, unknown> {
		return {};
	}

	/**
	 * Serialize the channel for JSON encoding.
	 *
	 * Provides a serializable representation of the channel for persistence
	 * or transmission. Uses the SerializesChannels concern.
	 *
	 * @returns Serialized channel object containing the channel name
	 *
	 * @example
	 * ```typescript
	 * const serialized = channel.toJSON();
	 * // { name: 'my-channel' }
	 * ```
	 */
	toJSON(): SerializedChannel {
		return { name: this._name };
	}
}
