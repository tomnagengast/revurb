import type { Application } from "../../application";
import type { Connection } from "../../contracts/connection";

/**
 * Channel interface representing a Pusher channel
 *
 * Provides methods for broadcasting messages to channel subscribers.
 * Channels manage their own connection pools and handle message distribution.
 */
export interface Channel {
	/**
	 * Get the channel name.
	 *
	 * @returns The channel name (e.g., "my-channel", "private-chat", "presence-room")
	 */
	name(): string;

	/**
	 * Broadcast a message to all connections subscribed to the channel.
	 *
	 * @param payload - The message payload to broadcast
	 * @param except - Optional connection to exclude from broadcast (for echo prevention)
	 */
	broadcast(payload: Record<string, any>, except?: Connection | null): void;
}

/**
 * ChannelManager interface for managing channels
 *
 * Provides methods to find and manage channels for an application.
 * Scoped per application to ensure channel isolation.
 */
export interface ChannelManager {
	/**
	 * Get the application instance.
	 *
	 * @returns The application this manager is scoped to, or null if not scoped
	 */
	app(): Application | null;

	/**
	 * Scope the channel manager to a specific application.
	 *
	 * @param application - The application to scope to
	 * @returns A scoped ChannelManager instance
	 */
	for(application: Application): ChannelManager;

	/**
	 * Find a channel by name.
	 *
	 * @param channel - The channel name to find
	 * @returns The Channel instance if found, null otherwise
	 */
	find(channel: string): Channel | null;
}

/**
 * Payload structure for event dispatching
 *
 * Represents the message payload to be dispatched to channels.
 * Can contain either a single channel or multiple channels.
 */
export interface EventPayload {
	/**
	 * Single channel name (mutually exclusive with channels)
	 */
	channel?: string;

	/**
	 * Multiple channel names (mutually exclusive with channel)
	 */
	channels?: string | string[];

	/**
	 * The event name
	 */
	event?: string;

	/**
	 * The event data
	 */
	data?: any;

	/**
	 * Additional payload properties
	 */
	[key: string]: any;
}

/**
 * EventDispatcher - Handles message dispatching to Pusher channels
 *
 * The EventDispatcher is responsible for routing messages to one or more channels
 * and ensuring proper delivery to all subscribed connections, with support for
 * echo prevention via socket_id exclusion.
 *
 * Key Responsibilities:
 * - Parse channel specifications (single or multiple channels)
 * - Route messages to appropriate channels
 * - Handle socket_id exclusion for echo prevention
 * - Coordinate with ChannelManager for channel lookup
 *
 * Architecture Notes:
 * - This is a static utility class (no instance state)
 * - Delegates channel management to injected ChannelManager
 * - Supports both single-channel and multi-channel broadcasts
 *
 * @example
 * ```typescript
 * // Dispatch to a single channel
 * EventDispatcher.dispatch(
 *   app,
 *   { channel: 'my-channel', event: 'my-event', data: { foo: 'bar' } },
 *   channelManager
 * );
 *
 * // Dispatch to multiple channels (excluding sender)
 * EventDispatcher.dispatch(
 *   app,
 *   { channels: ['channel-1', 'channel-2'], event: 'broadcast', data: { msg: 'hi' } },
 *   channelManager,
 *   senderConnection
 * );
 * ```
 */
export class EventDispatcher {
	/**
	 * Dispatch a message to one or more channels.
	 *
	 * This is the main entry point for event dispatching. It handles both
	 * single-channel and multi-channel broadcasts, with optional connection
	 * exclusion for echo prevention.
	 *
	 * The method delegates to dispatchSynchronously for immediate delivery
	 * to all channel subscribers. In a distributed setup, this could be
	 * extended to publish to a pub/sub system instead.
	 *
	 * @param app - The application context
	 * @param payload - The event payload containing channel(s) and message data
	 * @param channelManager - The channel manager for finding channels
	 * @param connection - Optional connection to exclude from broadcast (for echo prevention)
	 *
	 * @example
	 * ```typescript
	 * // Basic dispatch
	 * EventDispatcher.dispatch(
	 *   app,
	 *   { channel: 'my-channel', event: 'update', data: { value: 42 } },
	 *   channelManager
	 * );
	 *
	 * // With echo prevention
	 * EventDispatcher.dispatch(
	 *   app,
	 *   { channel: 'chat', event: 'message', data: { text: 'hello' } },
	 *   channelManager,
	 *   senderConnection // This connection will not receive the message
	 * );
	 * ```
	 */
	static dispatch(
		app: Application,
		payload: EventPayload,
		channelManager: ChannelManager,
		connection?: Connection | null,
	): void {
		// For now, we always dispatch synchronously
		// In a distributed setup, this could check if pub/sub is enabled
		// and publish to a message broker instead
		EventDispatcher.dispatchSynchronously(
			app,
			payload,
			channelManager,
			connection,
		);
	}

	/**
	 * Notify all connections subscribed to the given channel(s).
	 *
	 * This method performs the actual message delivery to channel subscribers.
	 * It handles both single and multiple channel specifications, normalizing
	 * them into an array for uniform processing.
	 *
	 * The method ensures proper payload structure by:
	 * 1. Extracting channel names from payload (channels or channel)
	 * 2. Normalizing to array format
	 * 3. Looking up each channel via ChannelManager
	 * 4. Broadcasting to each channel with echo prevention
	 *
	 * @param app - The application context
	 * @param payload - The event payload containing channel(s) and message data
	 * @param channelManager - The channel manager for finding channels
	 * @param connection - Optional connection to exclude from broadcast
	 *
	 * @example
	 * ```typescript
	 * // Single channel
	 * EventDispatcher.dispatchSynchronously(
	 *   app,
	 *   { channel: 'updates', event: 'data', data: { value: 1 } },
	 *   channelManager
	 * );
	 *
	 * // Multiple channels with exclusion
	 * EventDispatcher.dispatchSynchronously(
	 *   app,
	 *   { channels: ['room-1', 'room-2'], event: 'msg', data: { text: 'hi' } },
	 *   channelManager,
	 *   senderConnection
	 * );
	 * ```
	 */
	static dispatchSynchronously(
		app: Application,
		payload: EventPayload,
		channelManager: ChannelManager,
		connection?: Connection | null,
	): void {
		// Extract channel names from payload
		// Supports both 'channels' (array) and 'channel' (single) properties
		const channelNames = EventDispatcher.normalizeChannels(
			payload.channels ?? payload.channel,
		);

		// Create a copy of payload to avoid mutating the original
		const broadcastPayload = { ...payload };

		// Remove 'channels' property as we'll set 'channel' individually
		delete broadcastPayload.channels;

		// Ensure channelManager is scoped to the application
		const scopedChannelManager =
			channelManager.app()?.id() === app.id()
				? channelManager
				: channelManager.for(app);

		// Broadcast to each channel
		for (const channelName of channelNames) {
			// Look up the channel
			const channel = scopedChannelManager.find(channelName);

			// Skip if channel doesn't exist
			if (!channel) {
				continue;
			}

			// Set the specific channel name in the payload
			broadcastPayload.channel = channel.name();

			// Broadcast to all subscribers, excluding the specified connection
			channel.broadcast(broadcastPayload, connection ?? null);
		}
	}

	/**
	 * Normalize channel specification to array format.
	 *
	 * Handles various channel specification formats:
	 * - undefined/null → empty array
	 * - string → single-element array
	 * - array → returns as-is
	 *
	 * This ensures consistent array-based iteration in dispatchSynchronously.
	 *
	 * @param channels - The channel specification (string, array, or undefined)
	 * @returns Array of channel names
	 *
	 * @private
	 */
	private static normalizeChannels(channels?: string | string[]): string[] {
		if (!channels) {
			return [];
		}

		if (Array.isArray(channels)) {
			return channels;
		}

		return [channels];
	}
}
