/**
 * Types for channel serialization
 */
export interface SerializedChannel {
	name: string;
}

export interface ChannelConnectionManager {
	for(channelName: string): any;
}

/**
 * Utility functions for serializing and deserializing channels.
 * Provides methods to prepare channel instances for serialization
 * and restore them after deserialization.
 */

/**
 * Serialize a channel instance to a plain object.
 * Prepares the channel instance values for serialization by
 * extracting only the essential data (channel name).
 *
 * @param channel - The channel instance with a name property
 * @returns Serialized channel object containing only the name
 */
export function serializeChannel<T extends { name: string }>(
	channel: T,
): SerializedChannel {
	return {
		name: channel.name,
	};
}

/**
 * Deserialize a channel from a serialized object.
 * Restores the channel after serialization by reconstructing
 * the connections using the channel connection manager.
 *
 * @param values - The serialized channel data
 * @param channelConnectionManager - The channel connection manager instance
 * @returns Object containing the restored channel properties
 */
export function deserializeChannel(
	values: SerializedChannel,
	channelConnectionManager: ChannelConnectionManager,
): { name: string; connections: any } {
	return {
		name: values.name,
		connections: channelConnectionManager.for(values.name),
	};
}

/**
 * Create a serializable mixin for channel classes.
 * This provides a standard way to add serialization support to channel instances.
 *
 * @param channelConnectionManager - The channel connection manager instance
 * @returns Object with serialize and deserialize methods
 */
export function createChannelSerializer(
	channelConnectionManager: ChannelConnectionManager,
) {
	return {
		/**
		 * Serialize the current channel instance.
		 *
		 * @param channel - The channel instance to serialize
		 * @returns Serialized channel data
		 */
		serialize<T extends { name: string }>(channel: T): SerializedChannel {
			return serializeChannel(channel);
		},

		/**
		 * Deserialize and apply values to a channel instance.
		 *
		 * @param channel - The channel instance to update
		 * @param values - The serialized channel data
		 */
		deserialize<T extends { name: string; connections?: any }>(
			channel: T,
			values: SerializedChannel,
		): void {
			const deserialized = deserializeChannel(values, channelConnectionManager);
			channel.name = deserialized.name;
			channel.connections = deserialized.connections;
		},
	};
}

/**
 * Apply serialization behavior to a channel instance.
 * This function adds toJSON support to make the channel JSON-serializable.
 *
 * @param channel - The channel instance
 * @returns The channel with added serialization support
 */
export function makeChannelSerializable<T extends { name: string }>(
	channel: T,
): T & { toJSON(): SerializedChannel } {
	return Object.assign(channel, {
		toJSON(): SerializedChannel {
			return serializeChannel(channel);
		},
	});
}

/**
 * Restore a channel from its serialized form.
 * Factory function to create a new channel instance from serialized data.
 *
 * @param SerializedData - The serialized channel data
 * @param channelConnectionManager - The channel connection manager instance
 * @param channelClass - The channel class constructor
 * @returns A new channel instance with restored connections
 */
export function restoreChannel<T extends { name: string; connections?: any }>(
	serializedData: SerializedChannel,
	channelConnectionManager: ChannelConnectionManager,
	channelClass: new (name: string, connections: any) => T,
): T {
	const deserialized = deserializeChannel(
		serializedData,
		channelConnectionManager,
	);
	return new channelClass(deserialized.name, deserialized.connections);
}
