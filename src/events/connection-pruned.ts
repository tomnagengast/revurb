import type { ChannelConnection } from "../protocols/pusher/Channels/channel-connection";
import { EventDispatcher } from "./event-dispatcher";

/**
 * ConnectionPruned Event
 *
 * Dispatched when a connection is pruned (removed/cleaned up) from a channel.
 * This typically happens when a connection becomes stale or inactive and is
 * removed by the system's cleanup process.
 * This event is used for monitoring, logging, and metrics collection.
 */
export class ConnectionPruned {
	/**
	 * Create a new ConnectionPruned event instance.
	 *
	 * @param connection - The channel connection that was pruned
	 */
	constructor(public readonly connection: ChannelConnection) {}

	/**
	 * Dispatch the ConnectionPruned event.
	 *
	 * @param connection - The channel connection that was pruned
	 */
	static dispatch(connection: ChannelConnection): void {
		const event = new ConnectionPruned(connection);
		EventDispatcher.emit("connection:pruned", event);
	}
}
