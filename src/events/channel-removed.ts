import type { Channel } from "../protocols/pusher/Channels/channel";
import { EventDispatcher } from "./event-dispatcher";

/**
 * ChannelRemoved Event
 *
 * Dispatched when a channel is removed from the WebSocket server.
 * This typically happens when the last connection unsubscribes from a channel.
 * This event is used for monitoring, logging, and metrics collection.
 */
export class ChannelRemoved {
	/**
	 * Create a new ChannelRemoved event instance.
	 *
	 * @param channel - The channel that was removed
	 */
	constructor(public readonly channel: Channel) {}

	/**
	 * Dispatch the ChannelRemoved event.
	 *
	 * @param channel - The channel that was removed
	 */
	static dispatch(channel: Channel): void {
		const event = new ChannelRemoved(channel);
		EventDispatcher.emit("channel:removed", event);
	}
}
