import { Application } from "../../application";
import type { IPubSubIncomingMessageHandler } from "../../servers/reverb/contracts/pubsub-incoming-message-handler";
import type { ChannelManager } from "./contracts/channel-manager";
import { EventDispatcher } from "./event-dispatcher";
import type { MetricsHandler } from "./metrics-handler";

/**
 * PubSub message event structure
 */
interface PubSubEvent {
	type?: string;
	application: string;
	socket_id?: string;
	payload: any;
	key?: string;
}

/**
 * PusherPubSubIncomingMessageHandler - Handles incoming Redis pub/sub messages
 *
 * This handler processes incoming messages from the PubSub provider (e.g., Redis)
 * and routes them to the appropriate handlers based on message type.
 *
 * Message Types:
 * 1. 'message' - Dispatch events to channels
 * 2. 'metrics' - Publish metrics to other servers
 * 3. 'terminate' - Terminate user connections
 *
 * Key Responsibilities:
 * - Parse JSON payloads from PubSub messages
 * - Deserialize application data
 * - Route messages to appropriate handlers
 * - Handle socket_id exclusion for echo prevention
 * - Coordinate with EventDispatcher, MetricsHandler, and ChannelManager
 *
 * Architecture Notes:
 * - Implements IPubSubIncomingMessageHandler interface
 * - Uses JSON.parse for payload parsing (NOT PHP unserialize)
 * - Application field is parsed as JSON string
 * - Delegates to EventDispatcher for message broadcasting
 * - Delegates to MetricsHandler for metrics publishing
 * - Delegates to ChannelManager for connection management
 */
export class PusherPubSubIncomingMessageHandler
	implements IPubSubIncomingMessageHandler
{
	/**
	 * Create a new PusherPubSubIncomingMessageHandler instance.
	 *
	 * @param channelManager - The channel manager for accessing channels and connections
	 * @param metricsHandler - The metrics handler for publishing metrics
	 */
	constructor(
		private readonly channelManager: ChannelManager,
		private readonly metricsHandler: MetricsHandler,
	) {}

	/**
	 * Handle an incoming message from the PubSub provider.
	 *
	 * Parses the JSON payload and routes the message to the appropriate handler
	 * based on the message type.
	 *
	 * @param payload - The JSON-encoded message payload
	 *
	 * @example
	 * ```typescript
	 * handler.handle(JSON.stringify({
	 *   type: 'message',
	 *   application: '{"app_id":"123","key":"app-key",...}',
	 *   socket_id: '123.456',
	 *   payload: { channel: 'my-channel', event: 'update', data: 'value' }
	 * }));
	 * ```
	 */
	handle(payload: string): void {
		// Parse the JSON payload
		const event: PubSubEvent = JSON.parse(payload);

		// Deserialize the application from JSON string
		const application = this.deserializeApplication(event.application);

		// Get the connection to exclude (if socket_id is provided)
		const except = event.socket_id
			? (this.channelManager.for(application).connections()[event.socket_id] ??
				null)
			: null;

		// Route based on message type
		switch (event.type ?? null) {
			case "message":
				// Dispatch event to channels
				EventDispatcher.dispatchSynchronously(
					application,
					event.payload,
					this.channelManager,
					except?.connection() ?? null,
				);
				break;

			case "metrics":
				// Publish metrics
				this.metricsHandler.publish(
					application,
					event.key!,
					event.payload.type,
					event.payload.options ?? {},
				);
				break;

			case "terminate":
				// Terminate user connections
				const connections = Object.values(
					this.channelManager.for(application).connections(),
				);
				for (const connection of connections) {
					if (
						String(connection.data().get("user_id")) === event.payload.user_id
					) {
						connection.connection().disconnect();
					}
				}
				break;

			default:
				// Unknown message type - do nothing
				break;
		}
	}

	/**
	 * Deserialize an application from a JSON string.
	 *
	 * The application field in the PubSub message is a JSON-encoded string
	 * containing the application data. This method parses it and reconstructs
	 * an Application instance.
	 *
	 * @param serialized - The JSON-encoded application string
	 * @returns The deserialized Application instance
	 *
	 * @private
	 */
	private deserializeApplication(serialized: string): Application {
		const data = JSON.parse(serialized);
		return new Application(
			data.app_id,
			data.key,
			data.secret,
			data.ping_interval,
			data.activity_timeout,
			data.allowed_origins,
			data.max_message_size,
			data.max_connections ?? null,
			data.options ?? {},
		);
	}
}
