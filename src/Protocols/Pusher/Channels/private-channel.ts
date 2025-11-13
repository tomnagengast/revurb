import * as crypto from "crypto";
import type { Connection } from "../../../contracts/connection";
import type { ILogger } from "../../../contracts/logger";
import { ConnectionUnauthorized } from "../exceptions/connection-unauthorized";
import {
	Channel,
	type ChannelConnectionManager,
	type ChannelManager,
} from "./channel";

/**
 * Private Channel
 *
 * Extends Channel to provide authentication for private channels.
 * Private channels require clients to provide a valid authentication signature
 * before subscribing.
 *
 * Key Features:
 * - HMAC-SHA256 signature verification
 * - Requires valid auth token for subscription
 * - Protects against unauthorized access
 *
 * Channel Name Format:
 * - private-{channel-name}
 * - private-cache-{channel-name} (cached variant)
 *
 * Authentication Flow:
 * 1. Client requests subscription with auth signature
 * 2. Server verifies signature: HMAC-SHA256(socket_id:channel_name[:data], secret)
 * 3. If valid, subscription proceeds; otherwise ConnectionUnauthorized thrown
 *
 * Auth Signature Format:
 * - Format: "app_key:signature"
 * - Signature: HMAC-SHA256 hash of "socket_id:channel_name" or "socket_id:channel_name:data"
 * - Data: Optional channel data (required for presence channels)
 *
 * @example
 * ```typescript
 * const channel = new PrivateChannel(
 *   'private-chat',
 *   channelConnectionManager,
 *   channelManager,
 *   logger
 * );
 * const auth = 'app_key:abc123...'; // HMAC signature
 * await channel.subscribe(connection, auth);
 * ```
 */
export class PrivateChannel extends Channel {
	/**
	 * Create a new private channel instance.
	 *
	 * @param name - The channel name
	 * @param channelConnectionManager - Manager for handling channel connections
	 * @param channelManager - Manager for handling channels
	 * @param logger - Logger instance for logging channel operations
	 */
	constructor(
		name: string,
		channelConnectionManager: ChannelConnectionManager,
		channelManager: ChannelManager,
		logger: ILogger,
	) {
		super(name, channelConnectionManager, channelManager, logger);
	}
	/**
	 * Subscribe to the private channel.
	 *
	 * Verifies authentication before allowing subscription.
	 * Delegates to parent Channel.subscribe() after verification.
	 *
	 * @param connection - The connection to subscribe
	 * @param auth - The authentication signature
	 * @param data - Optional JSON-encoded channel data (used for presence)
	 * @throws {ConnectionUnauthorized} If authentication fails
	 */
	override subscribe(
		connection: Connection,
		auth: string | null = null,
		data: string | null = null,
	): void {
		this.verify(connection, auth, data);
		super.subscribe(connection, auth, data);
	}

	/**
	 * Verify the authentication token.
	 *
	 * Validates that the provided auth signature matches the expected HMAC-SHA256
	 * signature for the connection and channel.
	 *
	 * Signature String Format:
	 * - Without data: "{socket_id}:{channel_name}"
	 * - With data: "{socket_id}:{channel_name}:{data}"
	 *
	 * Auth Token Format:
	 * - "{app_key}:{signature}"
	 * - Only the signature portion (after ':') is validated
	 *
	 * @param connection - The connection attempting to subscribe
	 * @param auth - The authentication token
	 * @param data - Optional channel data to include in signature
	 * @returns true if authentication is valid
	 * @throws {ConnectionUnauthorized} If authentication fails or is invalid
	 * @protected
	 */
	protected verify(
		connection: Connection,
		auth: string | null = null,
		data: string | null = null,
	): boolean {
		// Build the signature string
		let signatureString = `${connection.id()}:${this.name()}`;

		if (data) {
			signatureString += `:${data}`;
		}

		// Extract the signature from auth token (format: "app_key:signature")
		const providedSignature = auth ? auth.split(":").slice(1).join(":") : "";

		// Compute expected signature
		const secret = connection.app().secret();
		const expectedSignature = crypto
			.createHmac("sha256", secret)
			.update(signatureString)
			.digest("hex");

		// Constant-time comparison to prevent timing attacks
		if (!this.timingSafeEqual(expectedSignature, providedSignature)) {
			throw new ConnectionUnauthorized();
		}

		return true;
	}

	/**
	 * Timing-safe string comparison.
	 *
	 * Compares two strings in constant time to prevent timing attacks.
	 * Uses crypto.timingSafeEqual for security.
	 *
	 * @param a - First string to compare
	 * @param b - Second string to compare
	 * @returns true if strings are equal, false otherwise
	 * @private
	 */
	private timingSafeEqual(a: string, b: string): boolean {
		// If lengths differ, use dummy comparison to maintain constant time
		if (a.length !== b.length) {
			// Compare with dummy value to maintain constant time
			const dummy = "a".repeat(a.length);
			crypto.timingSafeEqual(Buffer.from(a), Buffer.from(dummy));
			return false;
		}

		try {
			return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
		} catch {
			return false;
		}
	}
}
