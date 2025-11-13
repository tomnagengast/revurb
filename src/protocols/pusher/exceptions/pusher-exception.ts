/**
 * Base exception class for Pusher protocol errors.
 * Provides Pusher-formatted error payloads for WebSocket communication.
 */
export abstract class PusherException extends Error {
	/**
	 * The error code associated with the exception.
	 * This typically corresponds to WebSocket close codes (4000-4999).
	 */
	protected abstract code: number;

	/**
	 * The error message associated with the exception.
	 */
	protected abstract errorMessage: string;

	constructor(message?: string) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}

	/**
	 * Get the Pusher formatted error payload.
	 */
	payload(): { event: string; data: string } {
		return {
			event: "pusher:error",
			data: JSON.stringify({
				code: this.code,
				message: this.errorMessage,
			}),
		};
	}

	/**
	 * Get the encoded Pusher formatted error payload.
	 */
	toMessage(): string {
		return JSON.stringify(this.payload());
	}

	/**
	 * Get the error code.
	 */
	getCode(): number {
		return this.code;
	}

	/**
	 * Get the error message.
	 */
	getErrorMessage(): string {
		return this.errorMessage;
	}
}
