/**
 * Pusher Protocol Event Handler
 *
 * Handles incoming Pusher protocol events and routes them to appropriate handlers.
 * Supports all standard Pusher protocol messages including:
 * - Connection lifecycle (connection_established)
 * - Channel subscriptions (subscribe, unsubscribe)
 * - Keep-alive (ping, pong)
 * - Client events (client-*)
 *
 * This is the main entry point for processing Pusher protocol messages received
 * from WebSocket connections.
 *
 * @see https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/
 */

import type { Connection } from "../../contracts/connection";

/**
 * Channel interface (minimal definition needed for EventHandler)
 * Represents a Pusher channel that connections can subscribe to.
 */
export interface Channel {
	/**
	 * Get the channel name
	 */
	name(): string;

	/**
	 * Subscribe a connection to this channel
	 *
	 * @param connection - The connection to subscribe
	 * @param auth - Optional authentication signature for private/presence channels
	 * @param data - Optional channel data (JSON string for presence channels)
	 */
	subscribe(
		connection: Connection,
		auth?: string | null,
		data?: string | null,
	): void;

	/**
	 * Unsubscribe a connection from this channel
	 *
	 * @param connection - The connection to unsubscribe
	 */
	unsubscribe(connection: Connection): void;

	/**
	 * Get the data associated with the channel
	 * Used for subscription_succeeded messages
	 *
	 * @returns Channel data object (empty for public channels, presence data for presence channels)
	 */
	data(): Record<string, unknown>;
}

/**
 * CacheChannel interface
 * Extends Channel with cache-specific functionality for cache-enabled channels.
 */
export interface CacheChannel extends Channel {
	/**
	 * Determine if the channel has a cached payload
	 */
	hasCachedPayload(): boolean;

	/**
	 * Get the cached payload
	 */
	cachedPayload(): Record<string, unknown> | null;
}

/**
 * Type guard to check if a channel is a CacheChannel
 */
export function isCacheChannel(channel: Channel): channel is CacheChannel {
	return "hasCachedPayload" in channel && "cachedPayload" in channel;
}

/**
 * ChannelManager interface (minimal definition needed for EventHandler)
 * Manages channels for an application, providing lookup and lifecycle operations.
 */
export interface ChannelManager {
	/**
	 * Scope the channel manager to a specific application
	 *
	 * @param application - The application to scope to
	 * @returns A scoped ChannelManager instance
	 */
	for(application: any): ChannelManager;

	/**
	 * Find a channel by name
	 *
	 * @param channel - The channel name
	 * @returns The channel instance or null if not found
	 */
	find(channel: string): Channel | null;

	/**
	 * Find or create a channel by name
	 *
	 * @param channel - The channel name
	 * @returns The channel instance (existing or newly created)
	 */
	findOrCreate(channel: string): Channel;

	/**
	 * Get all channels
	 *
	 * @returns Object mapping channel names to channel instances
	 */
	all(): Record<string, Channel>;

	/**
	 * Remove a channel
	 *
	 * @param channel - The channel to remove
	 */
	remove(channel: Channel): void;
}

/**
 * Subscription data validation schema
 */
interface SubscriptionValidation {
	channel?: string;
	auth?: string;
	channel_data?: string;
}

/**
 * EventHandler class
 *
 * Main handler for Pusher protocol events. Routes incoming events to appropriate
 * methods and manages connection/channel lifecycle.
 *
 * @example
 * ```typescript
 * const handler = new EventHandler(channelManager);
 *
 * // Handle incoming message
 * handler.handle(connection, 'pusher:subscribe', {
 *   channel: 'my-channel',
 *   auth: 'signature',
 *   channel_data: '{"user_id":"123"}'
 * });
 * ```
 */
export class EventHandler {
	/**
	 * Create a new EventHandler instance
	 *
	 * @param channels - The channel manager for routing subscriptions
	 */
	constructor(protected readonly channels: ChannelManager) {}

	/**
	 * Handle an incoming Pusher event
	 *
	 * Routes the event to the appropriate handler method based on event type.
	 * Supports the following events:
	 * - pusher:connection_established - Acknowledge connection
	 * - pusher:subscribe - Subscribe to a channel
	 * - pusher:unsubscribe - Unsubscribe from a channel
	 * - pusher:ping - Respond with pong
	 * - pusher:pong - Update connection activity
	 * - client-* - Client events (handled elsewhere, not in EventHandler)
	 *
	 * @param connection - The connection that sent the event
	 * @param event - The event name (e.g., "pusher:subscribe")
	 * @param payload - The event payload data
	 * @throws Error if the event type is unknown
	 */
	handle(
		connection: Connection,
		event: string,
		payload: Record<string, unknown> = {},
	): void {
		// Strip "pusher:" prefix if present
		const eventName = event.startsWith("pusher:") ? event.substring(7) : event;

		switch (eventName) {
			case "connection_established":
				this.acknowledge(connection);
				break;

			case "subscribe":
				this.subscribe(
					connection,
					payload.channel as string,
					(payload.auth as string) || null,
					(payload.channel_data as string) || null,
				);
				break;

			case "unsubscribe":
				this.unsubscribe(connection, payload.channel as string);
				break;

			case "ping":
				this.pong(connection);
				break;

			case "pong":
				connection.touch();
				break;

			default:
				throw new Error(`Unknown Pusher event: ${eventName}`);
		}
	}

	/**
	 * Acknowledge the connection with a connection_established message
	 *
	 * Sends pusher:connection_established with the socket ID and activity timeout.
	 * This is typically the first message sent after a WebSocket connection is opened.
	 *
	 * @param connection - The connection to acknowledge
	 */
	acknowledge(connection: Connection): void {
		this.send(connection, "connection_established", {
			socket_id: connection.id(),
			activity_timeout: connection.app().activityTimeout(),
		});
	}

	/**
	 * Subscribe to a channel
	 *
	 * Validates the subscription data, finds or creates the channel, and
	 * subscribes the connection. Sends subscription_succeeded or cache_miss
	 * messages as appropriate.
	 *
	 * @param connection - The connection requesting subscription
	 * @param channelName - The name of the channel to subscribe to
	 * @param auth - Optional authentication signature for private/presence channels
	 * @param data - Optional channel data (JSON string for presence channels)
	 */
	subscribe(
		connection: Connection,
		channelName: string,
		auth: string | null = null,
		data: string | null = null,
	): void {
		// Validate subscription data
		const validationData: SubscriptionValidation = { channel: channelName };
		if (auth !== null) validationData.auth = auth;
		if (data !== null) validationData.channel_data = data;

		this.validateSubscription(validationData);

		// Find or create the channel (must scope to application first)
		const channel = this.channels
			.for(connection.app())
			.findOrCreate(channelName);

		// Subscribe the connection
		channel.subscribe(connection, auth, data);

		// Perform post-subscription actions
		this.afterSubscribe(channel, connection);
	}

	/**
	 * Validate subscription data
	 *
	 * Ensures that subscription parameters meet the required format:
	 * - channel: must be a string
	 * - auth: must be a string if provided
	 * - channel_data: must be valid JSON if provided
	 *
	 * @param data - The subscription data to validate
	 * @throws Error if validation fails
	 */
	protected validateSubscription(data: SubscriptionValidation): void {
		// Validate channel
		if (data.channel !== undefined && typeof data.channel !== "string") {
			throw new Error("The channel field must be a string");
		}

		// Validate auth
		if (data.auth !== undefined && typeof data.auth !== "string") {
			throw new Error("The auth field must be a string");
		}

		// Validate channel_data (must be valid JSON if present)
		if (data.channel_data !== undefined) {
			if (typeof data.channel_data !== "string") {
				throw new Error("The channel_data field must be a string");
			}
			try {
				JSON.parse(data.channel_data);
			} catch {
				throw new Error("The channel_data field must be valid JSON");
			}
		}
	}

	/**
	 * Carry out actions after a subscription succeeds
	 *
	 * Sends pusher_internal:subscription_succeeded message and handles
	 * cache channels by sending cached payload or cache_miss message.
	 *
	 * @param channel - The channel that was subscribed to
	 * @param connection - The connection that subscribed
	 */
	protected afterSubscribe(channel: Channel, connection: Connection): void {
		// Send subscription_succeeded message
		this.sendInternally(
			connection,
			"subscription_succeeded",
			channel.data(),
			channel.name(),
		);

		// Handle cache channels
		if (isCacheChannel(channel)) {
			this.sendCachedPayload(channel, connection);
		}
	}

	/**
	 * Unsubscribe from a channel
	 *
	 * Finds the channel and unsubscribes the connection. If the channel
	 * becomes empty, it will be automatically removed by the channel itself.
	 *
	 * @param connection - The connection requesting unsubscription
	 * @param channelName - The name of the channel to unsubscribe from
	 */
	unsubscribe(connection: Connection, channelName: string): void {
		const channel = this.channels.for(connection.app()).find(channelName);
		channel?.unsubscribe(connection);
	}

	/**
	 * Send cached payload or cache_miss message
	 *
	 * For cache channels, sends the cached payload if available,
	 * otherwise sends a pusher:cache_miss message.
	 *
	 * @param channel - The cache channel
	 * @param connection - The connection to send to
	 */
	protected sendCachedPayload(
		channel: CacheChannel,
		connection: Connection,
	): void {
		if (channel.hasCachedPayload()) {
			const payload = channel.cachedPayload();
			if (payload) {
				connection.send(JSON.stringify(payload));
			}
			return;
		}

		// Send cache_miss message
		this.send(connection, "cache_miss", undefined, channel.name());
	}

	/**
	 * Respond to a ping with a pong message
	 *
	 * Sends pusher:pong in response to pusher:ping to maintain connection health.
	 *
	 * @param connection - The connection to send pong to
	 */
	pong(connection: Connection): void {
		this.send(connection, "pong");
	}

	/**
	 * Send a ping to a connection
	 *
	 * Uses either WebSocket control frames (PING) or application-level
	 * pusher:ping message depending on connection configuration.
	 * Marks the connection as pinged for staleness tracking.
	 *
	 * @param connection - The connection to ping
	 */
	ping(connection: Connection): void {
		if (connection.usesControlFrames()) {
			connection.control();
		} else {
			this.send(connection, "ping");
		}

		connection.ping();
	}

	/**
	 * Send a Pusher protocol message to a connection
	 *
	 * Formats and sends a message with the "pusher:" prefix.
	 * The data is JSON-encoded and filtered to remove empty values.
	 *
	 * @param connection - The connection to send to
	 * @param event - The event name (will be prefixed with "pusher:")
	 * @param data - Optional data payload
	 * @param channel - Optional channel name
	 */
	send(
		connection: Connection,
		event: string,
		data?: Record<string, unknown>,
		channel?: string,
	): void {
		const payload = this.formatPayload(event, data, channel);
		connection.send(payload);
	}

	/**
	 * Send an internal Pusher protocol message to a connection
	 *
	 * Formats and sends a message with the "pusher_internal:" prefix.
	 * Used for internal events like subscription_succeeded.
	 *
	 * @param connection - The connection to send to
	 * @param event - The event name (will be prefixed with "pusher_internal:")
	 * @param data - Optional data payload
	 * @param channel - Optional channel name
	 */
	sendInternally(
		connection: Connection,
		event: string,
		data?: Record<string, unknown>,
		channel?: string,
	): void {
		const payload = this.formatInternalPayload(event, data, channel);
		connection.send(payload);
	}

	/**
	 * Format a Pusher protocol message payload
	 *
	 * Creates a JSON-encoded message with:
	 * - event: prefixed with "pusher:" (or custom prefix)
	 * - data: JSON-encoded data object (omitted if empty)
	 * - channel: channel name (omitted if not provided)
	 *
	 * @param event - The event name
	 * @param data - Optional data payload
	 * @param channel - Optional channel name
	 * @param prefix - Event prefix (default: "pusher:")
	 * @returns JSON-encoded message string
	 */
	formatPayload(
		event: string,
		data?: Record<string, unknown>,
		channel?: string,
		prefix = "pusher:",
	): string {
		const payload: Record<string, unknown> = {
			event: `${prefix}${event}`,
		};

		// Add data if provided and not empty
		if (data && Object.keys(data).length > 0) {
			payload.data = JSON.stringify(data);
		}

		// Add channel if provided
		if (channel !== undefined) {
			payload.channel = channel;
		}

		return JSON.stringify(payload);
	}

	/**
	 * Format an internal Pusher protocol message payload
	 *
	 * Creates a JSON-encoded message with:
	 * - event: prefixed with "pusher_internal:"
	 * - data: JSON-encoded data object (always included, even if empty)
	 * - channel: channel name (omitted if not provided)
	 *
	 * @param event - The event name
	 * @param data - Optional data payload
	 * @param channel - Optional channel name
	 * @returns JSON-encoded message string
	 */
	formatInternalPayload(
		event: string,
		data?: Record<string, unknown>,
		channel?: string,
	): string {
		const payload: Record<string, unknown> = {
			event: `pusher_internal:${event}`,
			data: JSON.stringify(data || {}),
		};

		// Add channel if provided
		if (channel !== undefined) {
			payload.channel = channel;
		}

		return JSON.stringify(payload);
	}
}
