/**
 * Channel Broker - Factory for creating channel instances
 *
 * The ChannelBroker is responsible for instantiating the correct channel type
 * based on the channel name prefix. This follows the factory pattern to encapsulate
 * the channel creation logic.
 *
 * Channel Type Detection Order (most specific first):
 * 1. private-cache-* → PrivateCacheChannel
 * 2. presence-cache-* → PresenceCacheChannel
 * 3. cache-* → CacheChannel
 * 4. private-* → PrivateChannel
 * 5. presence-* → PresenceChannel
 * 6. * (default) → Channel
 *
 * @see Laravel\Reverb\Protocols\Pusher\Channels\ChannelBroker (PHP)
 */

import type { ILogger } from "../../../contracts/logger.js";
import { CacheChannel } from "./cache-channel.js";
import {
	Channel,
	type ChannelConnectionManager,
	type ChannelManager,
} from "./channel.js";
import { PresenceCacheChannel } from "./presence-cache-channel.js";
import { PresenceChannel } from "./presence-channel.js";
import { PrivateCacheChannel } from "./private-cache-channel.js";
import { PrivateChannel } from "./private-channel.js";

/**
 * Channel Broker - Factory for creating appropriate channel instances
 *
 * The broker inspects the channel name prefix to determine the correct
 * channel type. Order matters - more specific prefixes must be checked first.
 */
export class ChannelBroker {
	/**
	 * Create the appropriate channel instance based on the channel name
	 *
	 * @param name - The channel name (e.g., "private-cache-my-channel")
	 * @param channelConnectionManager - The channel connection manager instance
	 * @param channelManager - The channel manager instance
	 * @param logger - The logger instance
	 * @returns The appropriate Channel instance
	 */
	static create(
		name: string,
		channelConnectionManager: ChannelConnectionManager,
		channelManager: ChannelManager,
		logger: ILogger,
	): Channel {
		// Order is critical - check most specific prefixes first
		if (name.startsWith("private-cache-")) {
			return new PrivateCacheChannel(
				name,
				channelConnectionManager,
				channelManager,
				logger,
			);
		}

		if (name.startsWith("presence-cache-")) {
			return new PresenceCacheChannel(
				name,
				channelConnectionManager,
				channelManager,
				logger,
			);
		}

		if (name.startsWith("cache-")) {
			return new CacheChannel(
				name,
				channelConnectionManager,
				channelManager,
				logger,
			);
		}

		if (name.startsWith("private-")) {
			return new PrivateChannel(
				name,
				channelConnectionManager,
				channelManager,
				logger,
			);
		}

		if (name.startsWith("presence-")) {
			return new PresenceChannel(
				name,
				channelConnectionManager,
				channelManager,
				logger,
			);
		}

		// Default to public channel
		return new Channel(name, channelConnectionManager, channelManager, logger);
	}
}
