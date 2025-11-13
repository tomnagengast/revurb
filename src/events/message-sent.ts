import type { Connection } from "../contracts/connection";
import { EventDispatcher } from "./event-dispatcher";

/**
 * MessageSent Event
 *
 * Dispatched when a message is sent over a WebSocket connection.
 * This event is used for monitoring, logging, and metrics collection.
 */
export class MessageSent {
	/**
	 * Create a new MessageSent event instance.
	 *
	 * @param connection - The connection that sent the message
	 * @param message - The message that was sent
	 */
	constructor(
		public readonly connection: Connection,
		public readonly message: string,
	) {}

	/**
	 * Dispatch the MessageSent event.
	 *
	 * @param connection - The connection that sent the message
	 * @param message - The message that was sent
	 */
	static dispatch(connection: Connection, message: string): void {
		const event = new MessageSent(connection, message);
		EventDispatcher.emit("message:sent", event);
	}
}
