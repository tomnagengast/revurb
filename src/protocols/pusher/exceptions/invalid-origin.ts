import { PusherException } from "./pusher-exception";

/**
 * Exception thrown when a connection origin is not allowed.
 * WebSocket close code: 4009
 */
export class InvalidOrigin extends PusherException {
	/**
	 * The error code associated with the exception.
	 */
	protected code = 4009;

	/**
	 * The error message associated with the exception.
	 */
	protected errorMessage = "Origin not allowed";
}
