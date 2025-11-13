import type { Connection } from "../contracts/connection";
import { EventDispatcher } from "./event-dispatcher";

/**
 * MessageReceived Event
 *
 * Dispatched when a message is received over a WebSocket connection.
 * This event is used for monitoring, logging, and metrics collection.
 */
export class MessageReceived {
	/**
	 * Create a new MessageReceived event instance.
	 *
	 * @param connection - The connection that received the message
	 * @param message - The message that was received
	 */
	constructor(
		public readonly connection: Connection,
		public readonly message: string,
	) {}

	/**
	 * Dispatch the MessageReceived event.
	 *
	 * @param connection - The connection that received the message
	 * @param message - The message that was received
	 */
	static dispatch(connection: Connection, message: string): void {
		const event = new MessageReceived(connection, message);
		EventDispatcher.emit("message:received", event);
	}
}
