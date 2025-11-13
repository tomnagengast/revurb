import type { Application } from "./application";
import { Connection as ConnectionContract } from "./contracts/connection";
import type {
	FrameOpcode,
	IWebSocketConnection,
} from "./contracts/websocket-connection";
import { FrameOpcode as FrameOpcodeEnum } from "./contracts/websocket-connection";
import { MessageSent } from "./events/message-sent";

/**
 * Connection Implementation
 *
 * Concrete implementation of the Connection contract that wraps a WebSocket
 * connection with application context and state management.
 *
 * This class implements the Pusher-compatible connection wrapper, handling:
 * - Connection identification and normalization
 * - Message sending with event dispatching
 * - Control frame management (PING/PONG)
 * - Connection lifecycle and termination
 *
 * The connection maintains state through the abstract base class:
 * - lastSeenAt: Timestamp tracking for activity monitoring
 * - hasBeenPinged: Ping state for stale connection detection
 * - usesControlFrames: Whether the connection uses control frames
 *
 * @see Connection contract for state machine documentation
 */
export class Connection extends ConnectionContract {
	/**
	 * The normalized socket ID.
	 *
	 * Cached socket ID in Pusher format ("number.number").
	 * Generated once on first access and reused for connection lifetime.
	 *
	 * @private
	 */
	private _id: string | null = null;


	/**
	 * Get the raw socket connection identifier.
	 *
	 * Returns the underlying WebSocket connection's identifier as a string.
	 * This is the raw transport-level identifier, not the normalized socket ID.
	 *
	 * @returns The raw connection identifier as a string
	 */
	identifier(): string {
		return String(this.connection.id());
	}

	/**
	 * Get the normalized socket ID.
	 *
	 * Returns a Pusher-compatible socket ID in the format "number.number".
	 * The ID is generated once and cached for the lifetime of the connection.
	 *
	 * @returns The normalized socket ID (e.g., "123456789.987654321")
	 */
	id(): string {
		if (!this._id) {
			this._id = this.generateId();
		}

		return this._id;
	}

	/**
	 * Send a message to the connection.
	 *
	 * Sends a message over the WebSocket connection and dispatches
	 * a MessageSent event for monitoring and metrics collection.
	 *
	 * @param message - The message to send
	 */
	send(message: string): void {
		this.connection.send(message);

		MessageSent.dispatch(this, message);
	}

	/**
	 * Send a control frame to the connection.
	 *
	 * Sends a WebSocket control frame (PING, PONG, or CLOSE).
	 * Control frames are used for connection health checks and lifecycle management.
	 *
	 * @param type - The frame opcode (default: PING)
	 */
	control(type: FrameOpcode = FrameOpcodeEnum.PING): void {
		this.connection.send({
			payload: "",
			opcode: type,
			getContents: () => "",
		});
	}

	/**
	 * Terminate a connection.
	 *
	 * Closes the underlying WebSocket connection gracefully.
	 * This is the final operation on a connection and cannot be undone.
	 */
	terminate(): void {
		this.connection.close();
	}
}
