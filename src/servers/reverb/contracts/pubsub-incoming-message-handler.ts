/**
 * PubSubIncomingMessageHandler contract
 *
 * Defines the contract for handling incoming messages from a PubSub provider.
 * Implementations must handle incoming message payloads from external PubSub services.
 */

/**
 * PubSubIncomingMessageHandler interface.
 *
 * Defines the contract that PubSub message handlers must implement.
 * A PubSub provider will call the handle method with message payloads received from the pub/sub service.
 */
export interface IPubSubIncomingMessageHandler {
	/**
	 * Handle an incoming message from the PubSub provider.
	 *
	 * Implementations should process the incoming message payload and take appropriate action
	 * (e.g., broadcast to connected clients, update state, trigger events).
	 *
	 * @param payload - The message payload received from the PubSub provider as a string
	 */
	handle(payload: string): void;
}
